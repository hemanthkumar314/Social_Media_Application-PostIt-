import { useCallback, useState } from "react";
import { FileWithPath, useDropzone } from "react-dropzone";

import useImagePreview from "@/hooks/useImagePreview";

type ProfileUploaderProps = {
  fieldChange: (files: File[]) => void;
  mediaUrl: string;
};

const ProfileUploader = ({ fieldChange, mediaUrl }: ProfileUploaderProps) => {
  const [file, setFile] = useState<File>();
  const [error, setError] = useState('');
  const fileUrl = useImagePreview(file, mediaUrl);

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[]) => {
      const selectedFile = acceptedFiles[0];
      if (!selectedFile) return;
      setError('');
      setFile(selectedFile);
      fieldChange([selectedFile]);
    },
    [fieldChange]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDropAccepted: onDrop,
    onDropRejected: () => setError('Please select one PNG, JPEG, or WebP image up to 10 MiB.'),
    multiple: false,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpeg", ".jpg"],
      "image/webp": [".webp"],
    },
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps({'aria-label': 'Upload profile photo'})} className="cursor-pointer" />
      {error && <p role="alert" className="text-red">{error}</p>}

      <div className="gap-4 cursor-pointer flex-center">
        <img
          src={fileUrl || "/assets/icons/profile-placeholder.svg"}
          alt="image"
          className="object-cover object-top w-24 h-24 rounded-full"
        />
        <p className="text-primary-500 small-regular md:bbase-semibold">
          Change profile photo
        </p>
      </div>
    </div>
  );
};

export default ProfileUploader;
