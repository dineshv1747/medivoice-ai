package com.medivoice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.service.AiServices;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.util.List;

/**
 * Nova Agent Service - uses Amazon Nova Lite via LangChain4j agent
 * for medical symptom analysis.
 *
 * Uses a custom ChatLanguageModel implementation that wraps Nova Lite
 * via the AWS SDK v2 InvokeModel API.
 */
@Service
public class NovaAgentService {

    private static final Logger log = LoggerFactory.getLogger(NovaAgentService.class);
    private static final String NOVA_LITE_MODEL_ID = "amazon.nova-lite-v1:0";

    private static final String MEDICAL_SYSTEM_PROMPT =
        "You are MediVoice AI, a compassionate medical information assistant. " +
        "ALWAYS start your response with: '⚠️ MEDICAL DISCLAIMER: This information is educational only " +
        "and does not replace professional medical advice.' " +
        "Analyze symptoms carefully, suggest possible conditions (not definitive diagnoses), " +
        "recommend home care when appropriate, and ALWAYS advise seeing a real doctor. " +
        "Use simple, clear language suitable for elderly patients. " +
        "Flag emergencies (chest pain, breathing difficulty, severe bleeding) with immediate 911 advice.";

    @Autowired
    private BedrockRuntimeClient bedrockClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Analyze symptoms using Nova Lite via a LangChain4j AiServices agent.
     * A custom ChatLanguageModel wraps Nova Lite's InvokeModel API.
     */
    public String analyzeSymptoms(String symptoms) {
        log.info("Analyzing symptoms with Nova Lite LangChain4j agent: {}", symptoms);
        try {
            // Build a custom ChatLanguageModel backed by Nova Lite
            ChatLanguageModel novaLiteModel = buildNovaLiteChatModel();

            // Build the medical agent via LangChain4j AiServices
            MedicalAssistant agent = AiServices.builder(MedicalAssistant.class)
                .chatLanguageModel(novaLiteModel)
                .build();

            String response = agent.analyze(
                "Patient reports the following symptoms: " + symptoms +
                "\n\nPlease analyze these symptoms and provide medical information and guidance.");
            log.info("Nova Lite LangChain4j agent analysis complete");
            return response;

        } catch (Exception e) {
            log.error("LangChain4j agent failed, falling back to direct call", e);
            return analyzeSymptomsDirect(symptoms);
        }
    }

    /**
     * Analyze symptoms with combined image context.
     */
    public String analyzeSymptomsWithImageContext(String symptoms, String imageAnalysis) {
        log.info("Analyzing symptoms with image context using Nova Lite");
        String combined = "Patient symptoms: " + symptoms +
            "\n\nImage analysis context: " + imageAnalysis;
        return analyzeSymptoms(combined);
    }

    /**
     * Builds a ChatLanguageModel that calls Nova Lite directly via InvokeModel API.
     * This makes LangChain4j's AiServices work with any Bedrock model.
     */
    private ChatLanguageModel buildNovaLiteChatModel() {
        BedrockRuntimeClient client = this.bedrockClient;
        ObjectMapper mapper = this.objectMapper;

        return new ChatLanguageModel() {
            @Override
            public Response<AiMessage> generate(List<ChatMessage> messages) {
                try {
                    // Extract system and user messages
                    StringBuilder systemText = new StringBuilder(MEDICAL_SYSTEM_PROMPT);
                    StringBuilder userText = new StringBuilder();

                    for (ChatMessage msg : messages) {
                        if (msg instanceof SystemMessage sm) {
                            systemText.append("\n").append(sm.text());
                        } else if (msg instanceof UserMessage um) {
                            userText.append(um.singleText());
                        } else if (msg instanceof AiMessage am) {
                            // Previous AI turns - include as context
                            userText.append("\n[Previous AI response: ").append(am.text()).append("]");
                        }
                    }

                    // Build Nova Lite InvokeModel request body
                    ObjectNode requestBody = mapper.createObjectNode();

                    // System prompt
                    ArrayNode systemArray = mapper.createArrayNode();
                    ObjectNode systemObj = mapper.createObjectNode();
                    systemObj.put("text", systemText.toString());
                    systemArray.add(systemObj);
                    requestBody.set("system", systemArray);

                    // Messages
                    ArrayNode msgArray = mapper.createArrayNode();
                    ObjectNode userMsg = mapper.createObjectNode();
                    userMsg.put("role", "user");
                    ArrayNode userContent = mapper.createArrayNode();
                    ObjectNode textBlock = mapper.createObjectNode();
                    textBlock.put("text", userText.toString());
                    userContent.add(textBlock);
                    userMsg.set("content", userContent);
                    msgArray.add(userMsg);
                    requestBody.set("messages", msgArray);

                    // Inference config
                    ObjectNode inferenceConfig = mapper.createObjectNode();
                    inferenceConfig.put("maxTokens", 1024);
                    inferenceConfig.put("temperature", 0.3);
                    inferenceConfig.put("topP", 0.9);
                    requestBody.set("inferenceConfig", inferenceConfig);

                    InvokeModelRequest request = InvokeModelRequest.builder()
                        .modelId(NOVA_LITE_MODEL_ID)
                        .contentType("application/json")
                        .accept("application/json")
                        .body(SdkBytes.fromUtf8String(mapper.writeValueAsString(requestBody)))
                        .build();

                    InvokeModelResponse response = client.invokeModel(request);
                    var responseJson = mapper.readTree(response.body().asUtf8String());
                    String text = responseJson.path("output").path("message")
                        .path("content").get(0).path("text")
                        .asText("Unable to analyze symptoms.");

                    return Response.from(AiMessage.from(text));

                } catch (Exception e) {
                    log.error("Nova Lite invoke failed inside LangChain4j model", e);
                    return Response.from(AiMessage.from(
                        "⚠️ MEDICAL DISCLAIMER: This is for informational purposes only. " +
                        "I was unable to analyze your symptoms. Please consult a healthcare professional."));
                }
            }
        };
    }

    /**
     * Direct fallback: calls Nova Lite without LangChain4j.
     */
    private String analyzeSymptomsDirect(String symptoms) {
        log.info("Direct Nova Lite call for symptom analysis");
        try {
            ObjectNode requestBody = objectMapper.createObjectNode();

            ArrayNode systemArray = objectMapper.createArrayNode();
            ObjectNode systemObj = objectMapper.createObjectNode();
            systemObj.put("text", MEDICAL_SYSTEM_PROMPT);
            systemArray.add(systemObj);
            requestBody.set("system", systemArray);

            ArrayNode messages = objectMapper.createArrayNode();
            ObjectNode userMsg = objectMapper.createObjectNode();
            userMsg.put("role", "user");
            ArrayNode content = objectMapper.createArrayNode();
            ObjectNode textBlock = objectMapper.createObjectNode();
            textBlock.put("text", "Patient symptoms: " + symptoms);
            content.add(textBlock);
            userMsg.set("content", content);
            messages.add(userMsg);
            requestBody.set("messages", messages);

            ObjectNode inferenceConfig = objectMapper.createObjectNode();
            inferenceConfig.put("maxTokens", 1024);
            inferenceConfig.put("temperature", 0.3);
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
                .get(0).path("text").asText("Unable to analyze symptoms at this time.");

        } catch (Exception e) {
            log.error("Direct Nova Lite call failed", e);
            return "⚠️ MEDICAL DISCLAIMER: This is for informational purposes only. " +
                "Unable to analyze symptoms. Please consult a qualified healthcare professional.";
        }
    }

    /**
     * LangChain4j AI Service interface for the medical assistant.
     * Uses @dev.langchain4j.service.SystemMessage annotation.
     */
    @dev.langchain4j.service.SystemMessage(
        "You are MediVoice AI. ALWAYS start with the medical disclaimer. " +
        "Analyze symptoms, provide general information only, never diagnose definitively, " +
        "recommend professional medical consultation. Use simple language for elderly users."
    )
    interface MedicalAssistant {
        String analyze(String symptoms);
    }
}
