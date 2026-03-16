package com.medivoice.controller;

import com.medivoice.model.MedicalRequest;
import com.medivoice.model.MedicalResponse;
import com.medivoice.service.NovaAgentService;
import com.medivoice.service.NovaEmbedService;
import com.medivoice.service.NovaVoiceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Base64;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/medivoice")
@CrossOrigin(origins = "*")
public class MediVoiceController {

    private static final Logger log = LoggerFactory.getLogger(MediVoiceController.class);

    @Autowired
    private NovaVoiceService novaVoiceService;

    @Autowired
    private NovaAgentService novaAgentService;

    @Autowired
    private NovaEmbedService novaEmbedService;

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "MediVoice AI",
            "models", "Nova Sonic + Nova Lite + Nova Embed",
            "disclaimer", MedicalResponse.DISCLAIMER
        ));
    }

    /**
     * Main analysis endpoint - handles voice + optional image input.
     * POST /api/medivoice/analyze
     * Body: JSON with audioBase64, symptoms text, or imageBase64
     */
    @PostMapping("/analyze")
    public ResponseEntity<MedicalResponse> analyze(@RequestBody MedicalRequest request) {
        log.info("Received analysis request - hasAudio: {}, hasSymptoms: {}, hasImage: {}",
            request.getAudioBase64() != null,
            request.getSymptoms() != null,
            request.getImageBase64() != null);

        MedicalResponse.MedicalResponseBuilder responseBuilder = MedicalResponse.builder()
            .success(true);

        try {
            String symptomsText = request.getSymptoms();

            // Step 1: Speech-to-Text via Nova Sonic (if audio provided)
            if (request.getAudioBase64() != null && !request.getAudioBase64().isEmpty()) {
                log.info("Processing audio with Nova Sonic STT");
                byte[] audioBytes = Base64.getDecoder().decode(request.getAudioBase64());
                String transcribed = novaVoiceService.speechToText(audioBytes);
                responseBuilder.transcribedText(transcribed);

                // Combine transcribed text with any typed symptoms
                if (symptomsText == null || symptomsText.isEmpty()) {
                    symptomsText = transcribed;
                } else {
                    symptomsText = symptomsText + " " + transcribed;
                }
            }

            // Step 2: Image analysis via Nova Embed + Nova Lite (if image provided)
            String imageAnalysisText = null;
            if (request.getImageBase64() != null && !request.getImageBase64().isEmpty()) {
                log.info("Processing image with Nova Embed + Nova Lite");
                byte[] imageBytes = Base64.getDecoder().decode(request.getImageBase64());
                String mediaType = request.getImageMediaType() != null ?
                    request.getImageMediaType() : "image/jpeg";
                imageAnalysisText = novaEmbedService.analyzeImage(imageBytes, mediaType, "upload.jpg");
                responseBuilder.imageAnalysis(imageAnalysisText);
            }

            // Step 3: Symptom analysis via Nova Lite LangChain4j agent
            if (symptomsText != null && !symptomsText.isEmpty()) {
                log.info("Analyzing symptoms with Nova Lite agent");
                String analysis;
                if (imageAnalysisText != null) {
                    analysis = novaAgentService.analyzeSymptomsWithImageContext(symptomsText, imageAnalysisText);
                } else {
                    analysis = novaAgentService.analyzeSymptoms(symptomsText);
                }
                responseBuilder.analysisText(analysis);

                // Step 4: Text-to-Speech via Nova Sonic (async, 8s cap so text returns fast)
                log.info("Converting analysis to speech with Nova Sonic TTS");
                String ttsText = analysis.length() > 600 ?
                    analysis.substring(0, 600) + "... Please read the full response on screen." : analysis;
                try {
                    String audioBase64 = CompletableFuture
                        .supplyAsync(() -> novaVoiceService.textToSpeech(ttsText))
                        .get(45, TimeUnit.SECONDS);
                    responseBuilder.audioBase64(audioBase64);
                } catch (Exception ttsEx) {
                    log.warn("Nova Sonic TTS skipped ({}), returning text-only response", ttsEx.getClass().getSimpleName());
                }
            }

        } catch (Exception e) {
            log.error("Analysis failed", e);
            return ResponseEntity.internalServerError()
                .body(MedicalResponse.builder()
                    .success(false)
                    .errorMessage("Analysis failed: " + e.getMessage())
                    .analysisText(MedicalResponse.DISCLAIMER +
                        "\n\nUnable to process your request. Please try again or consult a healthcare professional.")
                    .build());
        }

        return ResponseEntity.ok(responseBuilder.build());
    }

    /**
     * Voice-only endpoint - accepts audio file upload
     * POST /api/medivoice/voice
     */
    @PostMapping(value = "/voice", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MedicalResponse> analyzeVoice(
        @RequestParam("audio") MultipartFile audioFile) {

        log.info("Received voice file: {} ({} bytes)", audioFile.getOriginalFilename(), audioFile.getSize());

        try {
            byte[] audioBytes = audioFile.getBytes();

            // STT with Nova Sonic
            String transcribed = novaVoiceService.speechToText(audioBytes);

            // Analyze with Nova Lite
            String analysis = novaAgentService.analyzeSymptoms(transcribed);

            // TTS with Nova Sonic
            String audioBase64 = novaVoiceService.textToSpeech(
                analysis.length() > 600 ? analysis.substring(0, 600) : analysis);

            return ResponseEntity.ok(MedicalResponse.builder()
                .success(true)
                .transcribedText(transcribed)
                .analysisText(analysis)
                .audioBase64(audioBase64)
                .build());

        } catch (Exception e) {
            log.error("Voice analysis failed", e);
            return ResponseEntity.internalServerError()
                .body(MedicalResponse.builder()
                    .success(false)
                    .errorMessage(e.getMessage())
                    .build());
        }
    }

    /**
     * Image analysis endpoint
     * POST /api/medivoice/image
     */
    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MedicalResponse> analyzeImage(
        @RequestParam("image") MultipartFile imageFile,
        @RequestParam(value = "symptoms", required = false) String symptoms) {

        log.info("Received image: {} ({} bytes)", imageFile.getOriginalFilename(), imageFile.getSize());

        try {
            byte[] imageBytes = imageFile.getBytes();
            String mediaType = imageFile.getContentType() != null ?
                imageFile.getContentType() : "image/jpeg";

            // Image analysis via Nova Embed + Nova Lite
            String imageAnalysis = novaEmbedService.analyzeImage(
                imageBytes, mediaType, imageFile.getOriginalFilename());

            // Combined analysis if symptoms provided
            String combinedAnalysis = symptoms != null && !symptoms.isEmpty()
                ? novaAgentService.analyzeSymptomsWithImageContext(symptoms, imageAnalysis)
                : imageAnalysis;

            return ResponseEntity.ok(MedicalResponse.builder()
                .success(true)
                .imageAnalysis(imageAnalysis)
                .analysisText(combinedAnalysis)
                .build());

        } catch (Exception e) {
            log.error("Image analysis failed", e);
            return ResponseEntity.internalServerError()
                .body(MedicalResponse.builder()
                    .success(false)
                    .errorMessage(e.getMessage())
                    .build());
        }
    }

    /**
     * Text-only symptoms analysis
     * POST /api/medivoice/symptoms
     */
    @PostMapping("/symptoms")
    public ResponseEntity<MedicalResponse> analyzeTextSymptoms(
        @RequestBody Map<String, String> body) {

        String symptoms = body.get("symptoms");
        if (symptoms == null || symptoms.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                .body(MedicalResponse.builder()
                    .success(false)
                    .errorMessage("Symptoms text is required")
                    .build());
        }

        log.info("Analyzing text symptoms: {}", symptoms);

        try {
            String analysis = novaAgentService.analyzeSymptoms(symptoms);
            String ttsInput = analysis.length() > 600 ? analysis.substring(0, 600) : analysis;
            String audioBase64 = "";
            try {
                audioBase64 = CompletableFuture
                    .supplyAsync(() -> novaVoiceService.textToSpeech(ttsInput))
                    .get(45, TimeUnit.SECONDS);
            } catch (Exception ttsEx) {
                log.warn("TTS skipped: {}", ttsEx.getClass().getSimpleName());
            }

            return ResponseEntity.ok(MedicalResponse.builder()
                .success(true)
                .analysisText(analysis)
                .audioBase64(audioBase64)
                .build());

        } catch (Exception e) {
            log.error("Text symptom analysis failed", e);
            return ResponseEntity.internalServerError()
                .body(MedicalResponse.builder()
                    .success(false)
                    .errorMessage(e.getMessage())
                    .build());
        }
    }
}
