package com.medivoice.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MedicalResponse {
    private String transcribedText;   // Text from Nova Sonic STT
    private String analysisText;      // Symptom analysis from Nova Lite
    private String imageAnalysis;     // Image analysis from Nova Embeddings/Lite
    private String audioBase64;       // Base64-encoded TTS audio from Nova Sonic
    private String s3ImageUrl;        // S3 URL if image was uploaded
    private boolean success;
    private String errorMessage;

    public static final String DISCLAIMER =
        "⚠️ MEDICAL DISCLAIMER: This AI assistant is for informational purposes only. " +
        "It does NOT replace professional medical advice, diagnosis, or treatment. " +
        "Always consult a qualified healthcare provider for medical concerns.";
}
