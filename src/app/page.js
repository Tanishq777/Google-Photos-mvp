'use client';

import { useState, useRef, useEffect } from 'react';
import { UploadCloud, Search, ImageIcon, AlertCircle } from 'lucide-react';

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default function Home() {
  const [photos, setPhotos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [queryEmbedding, setQueryEmbedding] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const fileInputRef = useRef(null);

  // Fetch embedding for semantic search with a debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setQueryEmbedding(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery })
        });
        const data = await res.json();
        if (data.embedding) {
          setQueryEmbedding(data.embedding);
        }
      } catch (err) {
        console.error("Search embedding failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDrag = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = function(e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    if (!isAnalyzing) {
      fileInputRef.current?.click();
    }
  };

  const analyzeImageWithAPI = async (base64Image, photoId) => {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }

      setPhotos(prev => 
        prev.map(p => 
          p.id === photoId 
            ? { ...p, tags: data.tags || [], caption: data.caption || "", embedding: data.embedding, analyzing: false } 
            : p
        )
      );
      setGlobalError('');
    } catch (error) {
      console.error(error);
      setGlobalError(error.message);
      // Remove the failed photo or mark it as error
      setPhotos(prev => 
        prev.map(p => 
          p.id === photoId 
            ? { ...p, tags: ['error'], caption: 'Failed to analyze image.', analyzing: false } 
            : p
        )
      );
    } finally {
      // Check if any other photos are still analyzing
      setPhotos(prev => {
        const stillAnalyzing = prev.some(p => p.analyzing);
        if (!stillAnalyzing) setIsAnalyzing(false);
        return prev;
      });
    }
  };

  const handleFiles = (files) => {
    setIsAnalyzing(true);
    setGlobalError('');
    
    Array.from(files).forEach(file => {
      if (!file.type.match('image.*')) return;
      
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      const url = URL.createObjectURL(file);
      
      // Add a placeholder card while analyzing
      setPhotos(prev => [{
        id,
        url,
        name: file.name,
        tags: [],
        caption: "GPT-4o is analyzing this image...",
        analyzing: true
      }, ...prev]);

      // Read file as base64 and send to API
      const reader = new FileReader();
      reader.onload = (e) => {
        analyzeImageWithAPI(e.target.result, id);
      };
      reader.readAsDataURL(file);
    });
  };

  // Perform semantic search
  const filteredPhotos = [...photos]
    .filter(photo => {
      // If we are currently uploading/analyzing this photo, always show it unless we have a strict search
      if (photo.analyzing && !searchQuery.trim()) return true;
      if (photo.analyzing) return false;

      if (!searchQuery.trim() || !queryEmbedding) return true;
      
      // Calculate semantic similarity
      if (photo.embedding) {
        photo.similarity = cosineSimilarity(queryEmbedding, photo.embedding);
        // Only show photos that are semantically similar (0.2 is a good baseline for text-embedding-3-small)
        return photo.similarity > 0.2;
      }
      
      // Fallback to text match if no embedding 
      const searchTerms = searchQuery.toLowerCase().split(' ');
      return searchTerms.some(term => 
        photo.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      if (searchQuery.trim() && queryEmbedding && a.similarity !== undefined && b.similarity !== undefined) {
        return b.similarity - a.similarity; // Highest similarity first
      }
      return 0; // maintain order
    });

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">Smart Gallery AI</h1>
        <p className="subtitle">
          Powered by GPT-4o. Upload an image and watch as the AI perfectly understands the scene. Search using semantic understanding, not just exact keywords.
        </p>
      </header>

      {globalError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <AlertCircle size={20} />
          <span>{globalError}</span>
        </div>
      )}

      <section className="upload-section">
        <div 
          className={`upload-area ${dragActive ? "drag-active" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            className="hidden-input" 
            multiple 
            accept="image/*" 
            onChange={handleChange} 
          />
          
          {isAnalyzing ? (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p className="loading-text">GPT-4o is generating rich tags...</p>
            </div>
          ) : (
            <>
              <UploadCloud className="upload-icon" size={64} />
              <p className="upload-text">Click or drag images here</p>
              <p className="upload-subtext">GPT-4o will instantly generate highly accurate tags and embeddings</p>
            </>
          )}
        </div>
      </section>

      {photos.length > 0 && (
        <>
          <section className="search-section">
            <div className="search-bar" style={{ position: 'relative' }}>
              <Search color={isSearching ? "var(--primary-color)" : "var(--text-secondary)"} size={20} />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Semantic Search (e.g. 'a cute puppy', 'something warm and sunny')..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <div style={{ position: 'absolute', right: '15px' }}>
                  <div className="spinner" style={{ width: '20px', height: '20px', borderTopColor: 'var(--primary-color)', marginBottom: 0 }}></div>
                </div>
              )}
            </div>
          </section>

          <section className="gallery-grid">
            {filteredPhotos.length > 0 ? (
              filteredPhotos.map(photo => (
                <div key={photo.id} className="photo-card" style={photo.analyzing ? { opacity: 0.7 } : {}}>
                  <div className="photo-image-container">
                    <img src={photo.url} alt={photo.name} className="photo-image" />
                    {photo.analyzing && (
                      <div className="loading-overlay" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <div className="spinner" style={{ width: '25px', height: '25px' }}></div>
                      </div>
                    )}
                  </div>
                  <div className="photo-tags" style={{ padding: '0.8rem 1rem 0.5rem' }}>
                    {photo.caption && <p style={{fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.8rem', fontStyle: 'italic'}}>"{photo.caption}"</p>}
                    
                    {photo.similarity !== undefined && searchQuery.trim() && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Match Score: {Math.round(photo.similarity * 100)}%
                      </div>
                    )}

                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                      {photo.tags.map(tag => {
                        // highlight exact matches just as a visual bonus, but search is now semantic
                        const isMatch = searchQuery && tag.toLowerCase().includes(searchQuery.toLowerCase().trim());
                        return (
                          <span key={tag} className={`tag ${isMatch ? 'match' : ''}`} style={tag === 'error' ? { background: '#ef4444', color: '#fff', borderColor: '#ef4444' } : {}}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                {isSearching ? (
                  <p>Searching context...</p>
                ) : (
                  <>
                    <ImageIcon size={48} color="var(--text-secondary)" style={{margin: '0 auto 1rem'}} />
                    <p>No photos semantically match your search.</p>
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
