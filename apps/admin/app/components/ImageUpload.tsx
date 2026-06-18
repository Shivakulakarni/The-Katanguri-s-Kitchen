import { useState, useRef } from 'react';
import { T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';

type ImageUploadProps = {
  currentImage?: string | null;
  onUploaded?: (imageUrl: string) => void;
  onUpload?: (imageUrl: string) => void;
  size?: number;
};

export function ImageUpload({ currentImage, onUploaded, onUpload, size = 120 }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Max 5MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Invalid file type. Use JPG, PNG, WebP, or GIF.');
      return;
    }

    setError(null);
    setUploading(true);

    // Preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    try {
      const formData = new FormData();
      formData.append('image', file);
      const h = getAuthHeaders();
      const res = await fetch('/api/v1/admin/upload/dish-image', { method: 'POST', headers: h, body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      const { imageUrl } = await res.json();
      if (onUploaded) onUploaded(imageUrl);
      if (onUpload) onUpload(imageUrl);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setPreview(currentImage || null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        style={{
          width: size, height: size, borderRadius: T.r3, overflow: 'hidden',
          border: `2px dashed ${preview ? T.hairline : T.muted}`,
          background: T.ghost, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', transition: 'border-color 0.2s',
        }}
        onClick={() => fileRef.current?.click()}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.primary; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = preview ? T.hairline : T.muted; }}
      >
        {preview ? (
          <img src={preview} alt="Dish" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 28, color: T.muted }}>📷</span>
        )}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: T.white, fontSize: 12, fontWeight: 700 }}>Uploading...</span>
          </div>
        )}
      </div>
      <input
        ref={fileRef} type="file" accept="image/*" onChange={handleFile}
        style={{ display: 'none' }}
      />
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>{error}</div>}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
        Click to upload • JPG, PNG, WebP • Max 5MB
      </div>
    </div>
  );
}
