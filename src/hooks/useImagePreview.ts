import { useEffect, useState } from 'react';

export default function useImagePreview(file: File | undefined, mediaUrl = '') {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return previewUrl || mediaUrl;
}
