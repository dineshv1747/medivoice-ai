# MediVoice AI 🏥

> An intelligent, voice-powered medical assistant that provides instant AI-driven health guidance through voice, text, and image inputs.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Java](https://img.shields.io/badge/Java-17%2B-orange.svg)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-green.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)
![AWS](https://img.shields.io/badge/AWS-Bedrock-FF9900.svg)

---

## Overview

MediVoice AI is a full-stack web application that lets users describe their symptoms via voice, text, or photo and receive instant AI-powered health guidance. It combines a React frontend with a Java Spring Boot backend, using AWS Bedrock AI models for natural language understanding and speech synthesis.

**Key capabilities:**
- 🎤 **Voice input** — speak symptoms aloud using the browser's speech recognition
- ⌨️ **Text input** — type symptoms and receive detailed AI analysis
- 📸 **Image analysis** — upload a photo for visual AI health assessment
- 🔊 **Voice responses** — AI-synthesized audio playback of health guidance
- 📋 **Search history** — every analysis saved per user, browsable anytime
- 🔐 **User auth** — login/register system with per-user data isolation

> ⚠️ **Medical Disclaimer:** MediVoice AI is for informational purposes only. It does not replace professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional.

---

## Features

| Feature | Description |
|---|---|
| Voice Recognition | Real-time browser speech-to-text via Web Speech API |
| AI Health Analysis | Large language model analysis of reported symptoms |
| Image Understanding | Visual AI assessment of uploaded medical photos |
| Text-to-Speech | AI-generated voice responses read back to the user |
| User Accounts | Register/login with per-user history stored in localStorage |
| Search History | Full history panel with date filtering and detail view |
| Responsive UI | Works on desktop and mobile browsers |
| Secure Storage | Images uploaded to AWS S3 with structured metadata |

---

## Tech Stack

### Frontend
- **React 18** — component-based UI
- **Web Speech API** — browser-native voice recognition
- **Web Audio API** — PCM audio playback for TTS responses
- **localStorage** — user auth and history persistence
- **CSS3** — custom responsive styling, no UI framework dependency

### Backend
- **Java 17** — core language
- **Spring Boot 3.2** — REST API framework
- **AWS SDK for Java v2** — Bedrock, S3 integrations
- **LangChain4j 0.32** — AI service abstraction layer
- **Jackson** — JSON serialization

### Cloud & AI
- **AWS Bedrock** — managed AI model inference
  - Nova Lite — symptom analysis (text + vision)
  - Nova Sonic — text-to-speech synthesis
  - Nova Embed — multimodal image embeddings
- **AWS S3** — image storage

---

## Getting Started

### Prerequisites

- Java 17+
- Node.js 18+ and npm
- Maven 3.8+
- AWS account with Bedrock access enabled in `us-east-1`
- AWS credentials with permissions for: `bedrock:InvokeModel`, `bedrock:InvokeModelWithBidirectionalStream`, `s3:PutObject`

### 1. Clone the repository

```bash
git clone https://github.com/your-username/medivoice-ai.git
cd medivoice-ai
```

### 2. Configure environment variables

Create a `.env` file in `backend/`:

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
```

### 3. Start the backend

```bash
cd backend
source .env
mvn spring-boot:run
```

The API will be available at `http://localhost:8080`.

### 4. Start the frontend

```bash
cd frontend
npm install
npm start
```

The app will open at `http://localhost:3000` and proxy API calls to port 8080.

---

## How to Use

1. **Register** — create an account on the Register page
2. **Login** — sign in with your credentials
3. **Choose an input method:**
   - **Voice** — click the microphone, speak your symptoms, click stop
   - **Text** — type your symptoms in the text area and click Analyze
   - **Image** — drag and drop or select a photo
4. **View the AI analysis** — results appear below the input section
5. **History** — click the 📋 History button in the header to view past searches

---

## Project Structure

```
medivoice-ai/
├── backend/
│   ├── src/main/java/com/medivoice/
│   │   ├── config/         # AWS client configuration
│   │   ├── controller/     # REST API endpoints
│   │   ├── model/          # Request/response DTOs
│   │   └── service/
│   │       ├── NovaAgentService.java   # LLM symptom analysis
│   │       ├── NovaVoiceService.java   # TTS via bidirectional streaming
│   │       └── NovaEmbedService.java   # Image analysis + embeddings
│   ├── src/main/resources/
│   │   └── application.properties
│   └── pom.xml
│
└── frontend/
    ├── public/
    └── src/
        ├── App.jsx             # Root component, auth, routing
        ├── LoginPage.jsx       # Login form
        ├── RegisterPage.jsx    # Registration form
        ├── VoiceButton.jsx     # Mic button + speech recognition
        ├── ImageUpload.jsx     # Drag-and-drop image uploader
        ├── ResponseDisplay.jsx # AI result display with audio playback
        ├── HistoryPanel.jsx    # Slide-in search history panel
        └── *.css               # Component styles
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/medivoice/symptoms` | Analyze text symptoms |
| `POST` | `/api/medivoice/analyze` | Analyze voice audio (base64) |
| `POST` | `/api/medivoice/image` | Analyze uploaded image |
| `GET`  | `/api/medivoice/health` | Health check |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key |
| `AWS_REGION` | No | Default: `us-east-1` |
| `S3_BUCKET_NAME` | Yes | S3 bucket for image storage |

---

## Screenshots

> _Add screenshots of the login page, main dashboard, voice input, and analysis results here._

---

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

Please follow the existing code style and include relevant tests where applicable.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Disclaimer

MediVoice AI provides general health information for **educational purposes only**. It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the guidance of a qualified healthcare provider with any questions you may have regarding a medical condition. In case of emergency, call your local emergency services immediately.
