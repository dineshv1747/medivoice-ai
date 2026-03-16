 package com.medivoice.model;

import lombok.Data;

@Data
public class MedicalRequest {
    private String symptoms;       // Text symptoms input
    private String audioBase64;    // Base64-encoded audio for Nova Sonic STT
    private String imageBase64;    // Base64-encoded image for Nova Multimodal
    private String imageMediaType; // e.g. "image/jpeg"
    private String sessionId;      // Optional session identifier
}
