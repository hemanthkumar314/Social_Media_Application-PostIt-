import {useCallback, useState} from 'react'
import {FileWithPath, useDropzone} from 'react-dropzone'
import { Button } from '../ui/button'
import useImagePreview from '@/hooks/useImagePreview'

type FileUploaderProps={
    fieldChange: (FILES:File[])=>void;
    mediaUrl?:string;
    id:string
}

const FileUploader = ({fieldChange,mediaUrl,id}:FileUploaderProps) => {
    const [file, setFile] = useState<File>();
    const [error, setError] = useState('');
    const fileUrl = useImagePreview(file, mediaUrl);
    
    const onDrop = useCallback((acceptedFiles:FileWithPath[]) => {
        const selectedFile = acceptedFiles[0];
        if (!selectedFile) return;
        setError('');
        setFile(selectedFile);
        fieldChange([selectedFile]);
      }, [fieldChange])

      const {getRootProps, getInputProps} = useDropzone({
        onDropAccepted: onDrop,
        onDropRejected: () => setError('Please select one PNG, JPEG, or WebP image up to 10 MiB.'),
        multiple: false,
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024,
        accept:{
            'image/png':['.png'],
            'image/jpeg':['.jpeg','.jpg'],
            'image/webp':['.webp']
        }
    })
    return (
        <div {...getRootProps()} 
        className='flex flex-col cursor-default rounded-xl flex-center bg-dark-3'>
        <input {...getInputProps({id, 'aria-label': 'Upload post photo'})} className='cursor-pointer'/>
        {error && <p role="alert" className="text-red p-4">{error}</p>}
        {
            fileUrl ? 
            (
                <>
                    <div className='flex justify-center flex-1 w-full p-5 lg:p-10'>
                        <img
                            src={fileUrl}
                            alt='image'
                            className="file_uploader-img"
                        />
                    </div>
                    <p className="file_uploader-label">Click or drag photo to replace</p>
                </>
            )
            :
            (
                <div className='file_uploader-box'>
                    <img
                        src='/assets/icons/file-upload.svg'
                        width={96}
                        height={77}
                        alt='file-upload'
                    />
                    <h3 className='mt-6 mb-2 base-medium text-light-2'>Drag Photo here</h3>
                    <p className='mb-6 text-light-4 small-regular'>PNG, JPEG, WebP · up to 10 MiB</p>

                    <Button type="button" className='shad-button_dark_4'>
                        select from computer
                    </Button>
                </div>
            )
        }
        </div>
    )
}

export default FileUploader
