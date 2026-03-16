# MediVoice AI 🏥🎙️

> Voice-powered medical assistant using **#AmazonNova** models on Amazon Bedrock

**⚠️ MEDICAL DISCLAIMER:** MediVoice AI is for informational purposes only. It does NOT replace professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical concerns. In case of emergency, call 911 immediately.

---

## Overview

MediVoice AI lets users speak their symptoms, upload medical photos, and receive AI-powered medical information — all powered by Amazon Nova's multimodal AI capabilities on Amazon Bedrock.

## Amazon Nova Models Used

| Model | Role | Usage |
|-------|------|-------|
| **Amazon Nova Sonic** (`amazon.nova-sonic-v1:0`) | Voice AI | Speech-to-Text (STT) + Text-to-Speech (TTS) via bidirectional streaming |
| **Amazon Nova Lite** (`amazon.nova-lite-v1:0`) | Multimodal LLM | Symptom analysis via LangChain4j agent + Visual image analysis |
| **Amazon Nova Multimodal Embeddings** (`amazon.nova-embed-v1`) | Embeddings | Image vectorization + Text semantic embeddings |

## Tech Stack

- **Backend:** Java 17 + Spring Boot 3.2 + Maven
- **Frontend:** React 18 + Web Audio API
- **AI Framework:** LangChain4j (Bedrock integration)
- **AWS SDK:** AWS SDK for Java v2 (`software.amazon.awssdk`)
- **Storage:** AWS S3

## Features

- 🎙️ **Big Microphone Button** — tap to speak symptoms directly
- 🔊 **Nova Sonic STT** — real-time voice transcription via bidirectional streaming
- 🧠 **Nova Lite Agent** — LangChain4j-powered symptom analysis
- 📷 **Photo Upload** — drag & drop medical photos for visual analysis
- 🔬 **Nova Multimodal Embeddings** — image vectorization for semantic understanding
- 🔊 **Nova Sonic TTS** — AI reads the response back to you
- 📦 **AWS S3** — secure medical image storage
- ⌨️ **Text Input** — type symptoms as an alternative to voice
- 📱 **Mobile-Friendly** — designed for all screen sizes including elderly users
- ⚠️ **Medical Disclaimer** — displayed prominently on every page

## Project Structure

```
medivoice-ai/
├── backend/
│   ├── src/main/java/com/medivoice/
│   │   ├── MediVoiceApplication.java          # Spring Boot entry point
│   │   ├── controller/
│   │   │   └── MediVoiceController.java        # REST API endpoints
│   │   ├── service/
│   │   │   ├── NovaVoiceService.java           # Nova Sonic STT + TTS
│   │   │   ├── NovaAgentService.java           # Nova Lite + LangChain4j agent
│   │   │   └── NovaEmbedService.java           # Nova Embed + S3 + Nova Lite vision
│   │   ├── config/
│   │   │   └── AwsConfig.java                  # AWS SDK v2 configuration
│   │   └── model/
│   │       ├── MedicalRequest.java
│   │       └── MedicalResponse.java
│   ├── src/main/resources/
│   │   └── application.properties
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── App.jsx                             # Main app + tab navigation
│   │   ├── App.css
│   │   ├── VoiceButton.jsx                     # Mic button + Web Audio API
│   │   ├── VoiceButton.css
│   │   ├── ImageUpload.jsx                     # Photo upload + drag-drop
│   │   ├── ImageUpload.css
│   │   ├── ResponseDisplay.jsx                 # Analysis results + audio player
│   │   └── ResponseDisplay.css
│   ├── public/index.html
│   └── package.json
├── .env                                        # Environment variables (never commit!)
├── .gitignore
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/medivoice/health` | Health check |
| POST | `/api/medivoice/analyze` | Full analysis (audio + image + symptoms) |
| POST | `/api/medivoice/voice` | Voice file upload analysis |
| POST | `/api/medivoice/image` | Image analysis with optional symptoms |
| POST | `/api/medivoice/symptoms` | Text symptom analysis |

## Setup & Run

### Prerequisites
- Java 17+
- Node.js 18+
- Maven 3.8+
- AWS account with Bedrock access (Nova models enabled in us-east-1)

### 1. Configure Environment Variables
```bash
# Copy .env values to your system, or set in application.properties
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
export S3_BUCKET_NAME=your-bucket-name
```

### 2. Enable Nova Models in AWS Console
Go to **Amazon Bedrock → Model Access** and enable:
- amazon.nova-sonic-v1:0
- amazon.nova-lite-v1:0
- amazon.nova-embed-v1

### 3. Start Backend
```bash
cd backend
mvn spring-boot:run
# Backend starts on http://localhost:8080
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm start
# Frontend starts on http://localhost:3000
```

### 5. Open Browser
Navigate to `http://localhost:3000`

## Usage

1. **Voice Input:** Click the large microphone button → speak symptoms → click again to stop → hear AI response
2. **Text Input:** Switch to "Type Symptoms" tab → type symptoms → click Analyze
3. **Photo Upload:** Switch to "Upload Photo" tab → drag & drop or click to upload → click Analyze

## Medical Safety Features

- Disclaimer on every page and every response
- Emergency 911 notice for life-threatening symptoms
- AI never provides definitive diagnoses
- All responses recommend consulting real healthcare providers
- Simple, large-font UI designed for elderly users

---

Built with ❤️ using **#AmazonNova** · Amazon Bedrock · AWS SDK for Java v2 · LangChain4j · Spring Boot 3 · React 18
