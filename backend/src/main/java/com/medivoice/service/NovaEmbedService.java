package com.medivoice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.core.sync.RequestBody;

import java.util.Base64;
import java.util.UUID;

/**
 * Nova Embed Service - handles image analysis using:
 * 1. Amazon Nova Multimodal Embeddings (amazon.nova-embed-v1) for embedding
 * 2. Amazon Nova Lite for visual analysis + medical context description
 * 3. AWS S3 for image storage
 */
@Service
public class NovaEmbedService {

    private static final Logger log = LoggerFactory.getLogger(NovaEmbedService.class);
    private static final String NOVA_EMBED_MODEL_ID = "amazon.nova-embed-v1:0";
    private static final String NOVA_LITE_MODEL_ID = "amazon.nova-lite-v1:0";

    @Autowired
    private BedrockRuntimeClient bedrockClient;

    @Autowired
    private S3Client s3Client;

    @Value("${s3.bucket.name}")
    private String s3BucketName;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Full image analysis pipeline:
     * 1. Upload image to S3
     * 2. Generate multimodal embeddings via Nova Embed
     * 3. Generate visual medical description via Nova Lite
     * Returns combined analysis text.
     */
    public String analyzeImage(byte[] imageBytes, String mediaType, String fileName) {
        log.info("Starting image analysis pipeline for {} ({} bytes)", fileName, imageBytes.length);

        // Step 1: Upload to S3
        String s3Key = uploadToS3(imageBytes, mediaType, fileName);

        // Step 2: Generate embeddings via Nova Multimodal Embed
        float[] embeddings = generateMultimodalEmbeddings(imageBytes, mediaType);

        // Step 3: Visual analysis via Nova Lite (multimodal)
        String visualAnalysis = analyzeImageWithNovaLite(imageBytes, mediaType);

        // Step 4: Build comprehensive analysis
        StringBuilder analysis = new StringBuilder();
        analysis.append("📸 Image Analysis Results:\n\n");
        analysis.append(visualAnalysis);

        if (embeddings != null && embeddings.length > 0) {
            analysis.append("\n\n[Multimodal embeddings generated: ").append(embeddings.length)
                .append(" dimensions - used for semantic image understanding]");
        }

        if (s3Key != null) {
            analysis.append("\n\nImage stored securely at: s3://").append(s3BucketName).append("/").append(s3Key);
        }

        return analysis.toString();
    }

    /**
     * Upload image to AWS S3.
     */
    private String uploadToS3(byte[] imageBytes, String mediaType, String fileName) {
        try {
            String extension = mediaType.contains("png") ? ".png" : ".jpg";
            String s3Key = "medical-images/" + UUID.randomUUID() + extension;

            PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(s3BucketName)
                .key(s3Key)
                .contentType(mediaType)
                .build();

            s3Client.putObject(putRequest, RequestBody.fromBytes(imageBytes));
            log.info("Image uploaded to S3: {}", s3Key);
            return s3Key;

        } catch (Exception e) {
            log.error("S3 upload failed", e);
            return null;
        }
    }

    /**
     * Generate multimodal embeddings using Amazon Nova Multimodal Embed.
     * This creates a vector representation of the image for semantic understanding.
     */
    public float[] generateMultimodalEmbeddings(byte[] imageBytes, String mediaType) {
        log.info("Generating Nova Multimodal Embeddings");
        try {
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            // Nova Embed multimodal request format
            ObjectNode requestBody = objectMapper.createObjectNode();

            // Input with image
            ArrayNode inputArray = objectMapper.createArrayNode();
            ObjectNode inputItem = objectMapper.createObjectNode();

            ObjectNode imageObj = objectMapper.createObjectNode();
            ObjectNode sourceObj = objectMapper.createObjectNode();
            sourceObj.put("type", "base64");
            sourceObj.put("media_type", mediaType);
            sourceObj.put("data", base64Image);
            imageObj.set("source", sourceObj);
            inputItem.set("image", imageObj);
            inputArray.add(inputItem);
            requestBody.set("input", inputArray);

            // Embedding types - multimodal
            ArrayNode embeddingTypes = objectMapper.createArrayNode();
            embeddingTypes.add("float");
            requestBody.set("embeddingTypes", embeddingTypes);

            InvokeModelRequest request = InvokeModelRequest.builder()
                .modelId(NOVA_EMBED_MODEL_ID)
                .contentType("application/json")
                .accept("application/json")
                .body(SdkBytes.fromUtf8String(objectMapper.writeValueAsString(requestBody)))
                .build();

            InvokeModelResponse response = bedrockClient.invokeModel(request);
            var responseJson = objectMapper.readTree(response.body().asUtf8String());

            // Extract float embeddings
            var embeddingsNode = responseJson.path("embeddingsByType").path("float");
            if (embeddingsNode.isArray()) {
                float[] result = new float[embeddingsNode.size()];
                for (int i = 0; i < embeddingsNode.size(); i++) {
                    result[i] = (float) embeddingsNode.get(i).asDouble();
                }
                log.info("Generated {} dimensional embeddings", result.length);
                return result;
            }

        } catch (Exception e) {
            log.error("Nova Embed failed", e);
        }
        return new float[0];
    }

    /**
     * Analyze image visually using Nova Lite's multimodal capabilities.
     * Describes what it sees in a medical context.
     */
    private String analyzeImageWithNovaLite(byte[] imageBytes, String mediaType) {
        log.info("Analyzing image with Nova Lite multimodal");
        try {
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            // Nova Lite multimodal message format
            ObjectNode requestBody = objectMapper.createObjectNode();

            // System
            ArrayNode systemArray = objectMapper.createArrayNode();
            ObjectNode systemObj = objectMapper.createObjectNode();
            systemObj.put("text",
                "You are a medical image analysis assistant. " +
                "Describe what you observe in this image from a medical perspective. " +
                "Note any visible symptoms, skin conditions, injuries, or medical indicators. " +
                "ALWAYS include: '⚠️ MEDICAL DISCLAIMER: This image analysis is for informational purposes only. " +
                "A qualified healthcare professional must examine any medical images for proper diagnosis.' " +
                "Be specific but avoid definitive diagnoses.");
            systemArray.add(systemObj);
            requestBody.set("system", systemArray);

            // Messages with image
            ArrayNode messages = objectMapper.createArrayNode();
            ObjectNode userMsg = objectMapper.createObjectNode();
            userMsg.put("role", "user");

            ArrayNode content = objectMapper.createArrayNode();

            // Image content block
            ObjectNode imageBlock = objectMapper.createObjectNode();
            ObjectNode imageContent = objectMapper.createObjectNode();
            imageContent.put("format", mediaType.contains("png") ? "png" : "jpeg");
            ObjectNode imageSource = objectMapper.createObjectNode();
            imageSource.put("type", "base64");
            imageSource.put("data", base64Image);
            imageContent.set("source", imageSource);
            imageBlock.set("image", imageContent);
            content.add(imageBlock);

            // Text question
            ObjectNode textBlock = objectMapper.createObjectNode();
            textBlock.put("text",
                "Please analyze this medical image and describe what you observe. " +
                "What symptoms or conditions are visible? What medical attention might be needed?");
            content.add(textBlock);

            userMsg.set("content", content);
            messages.add(userMsg);
            requestBody.set("messages", messages);

            // Inference config
            ObjectNode inferenceConfig = objectMapper.createObjectNode();
            inferenceConfig.put("maxTokens", 512);
            inferenceConfig.put("temperature", 0.2);
            requestBody.set("inferenceConfig", inferenceConfig);

            InvokeModelRequest request = InvokeModelRequest.builder()
                .modelId(NOVA_LITE_MODEL_ID)
                .contentType("application/json")
                .accept("application/json")
                .body(SdkBytes.fromUtf8String(objectMapper.writeValueAsString(requestBody)))
                .build();

            InvokeModelResponse response = bedrockClient.invokeModel(request);
            var responseJson = objectMapper.readTree(response.body().asUtf8String());

            return responseJson.path("output").path("message").path("content")
                .get(0).path("text").asText("Unable to analyze image.");

        } catch (Exception e) {
            log.error("Nova Lite image analysis failed", e);
            return "⚠️ MEDICAL DISCLAIMER: Image analysis is for informational purposes only. " +
                "Unable to analyze the image at this time. Please consult a healthcare professional.";
        }
    }

    /**
     * Generate text embeddings for symptom similarity search.
     */
    public float[] generateTextEmbeddings(String text) {
        log.info("Generating text embeddings with Nova Embed");
        try {
            ObjectNode requestBody = objectMapper.createObjectNode();

            ArrayNode inputArray = objectMapper.createArrayNode();
            ObjectNode inputItem = objectMapper.createObjectNode();
            inputItem.put("text", text);
            inputArray.add(inputItem);
            requestBody.set("input", inputArray);

            ArrayNode embeddingTypes = objectMapper.createArrayNode();
            embeddingTypes.add("float");
            requestBody.set("embeddingTypes", embeddingTypes);

            InvokeModelRequest request = InvokeModelRequest.builder()
                .modelId(NOVA_EMBED_MODEL_ID)
                .contentType("application/json")
                .accept("application/json")
                .body(SdkBytes.fromUtf8String(objectMapper.writeValueAsString(requestBody)))
                .build();

            InvokeModelResponse response = bedrockClient.invokeModel(request);
            var responseJson = objectMapper.readTree(response.body().asUtf8String());

            var embeddingsNode = responseJson.path("embeddingsByType").path("float");
            if (embeddingsNode.isArray()) {
                float[] result = new float[embeddingsNode.size()];
                for (int i = 0; i < embeddingsNode.size(); i++) {
                    result[i] = (float) embeddingsNode.get(i).asDouble();
                }
                return result;
            }
        } catch (Exception e) {
            log.error("Text embedding generation failed", e);
        }
        return new float[0];
    }
}
