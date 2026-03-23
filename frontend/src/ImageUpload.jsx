import React, { useState, useRef } from 'react';
import './ImageUpload.css';

/**
 * ImageUpload - handles photo upload for medical image analysis.
 * Uses Nova Multimodal Embeddings + Nova Lite for analysis.
 * Also uploads to AWS S3.
 */
function ImageUpload({ onResult, onError, onLoadingChange }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      onError('Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      onError('Image size must be under 10MB.');
      return;
    }

    setSelectedFile(file);

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    onLoadingChange(true);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (symptoms.trim()) {
        formData.append('symptoms', symptoms.trim());
      }

      const response = await fetch('/api/medivoice/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onResult(data);
      } else {
        onError(data.errorMessage || 'Image analysis failed. Please try again.');
      }

    } catch (err) {
      console.error('Image analysis error:', err);
      onError('Failed to analyze image. Please check your connection.');
    } finally {
      onLoadingChange(false);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSymptoms('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="image-upload-section">
      {!previewUrl ? (
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload medical image"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <div className="drop-zone-icon">📷</div>
          <p className="drop-zone-title">Upload Medical Photo</p>
          <p className="drop-zone-subtitle">
            Drag & drop or click to select<br />
            (skin conditions, injuries, rashes, etc.)
          </p>
          <p className="drop-zone-formats">JPG, PNG, WebP · Max 10MB</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={(e) => handleFileSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="image-preview-section">
          <div className="image-preview-container">
            <img
              src={previewUrl}
              alt="Medical image for analysis"
              className="image-preview"
            />
            <button
              className="clear-image-btn"
              onClick={clearImage}
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>

          <div className="image-upload-controls">
            <div className="nova-analysis-info">
              <span className="nova-chip">AI Image Analysis</span>
              <span className="chip-arrow">→</span>
              <span className="nova-chip">Visual Health Insights</span>
              <span className="chip-arrow">→</span>
              <span className="nova-chip">Secure Storage</span>
            </div>

            <textarea
              className="image-symptoms-input"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Optional: Describe additional symptoms to combine with image analysis..."
              rows={3}
            />

            <button
              className="analyze-image-btn"
              onClick={handleAnalyze}
            >
              🔬 Analyze Image
            </button>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="image-disclaimer">
        <p>⚠️ Photos analyzed by AI for informational purposes only. Not a medical diagnosis. Always consult a dermatologist or physician.</p>
      </div>
    </div>
  );
}

export default ImageUpload;
