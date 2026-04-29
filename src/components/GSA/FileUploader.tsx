// src/components/GSA/FileUploader.tsx

import React, { useState } from 'react';
import { Upload, X, Eye, FileText, CheckCircle } from 'lucide-react';

interface FileUploadProps {
  label: string;
  onUpload: (file: File) => void;
  status: 'pendente' | 'resolvido';
  existingUrl?: string;
  isUploading?: boolean;
}

export const FileUploader = ({ label, onUpload, status, existingUrl, isUploading }: FileUploadProps) => {
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      onUpload(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(selectedFile));
      } else {
        setPreview('pdf'); // Ícone para PDFs
      }
    }
  };

  const isPdf = preview === 'pdf' || (preview && preview.includes('.pdf')) || (preview && preview.includes('alt=media'));

  return (
    <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all relative overflow-hidden ${
      status === 'resolvido' ? 'border-emerald-100 bg-emerald-50' : 'border-dashed border-slate-200 bg-white'
    }`}>
      {isUploading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center space-y-2">
          <div className="size-6 border-2 border-blue-900/20 border-t-blue-900 rounded-full animate-spin"></div>
          <span className="text-[8px] font-black text-blue-900 uppercase tracking-widest animate-pulse">Analisando...</span>
        </div>
      )}
      <div className="flex justify-between items-center mb-2 md:mb-3">
        <span className="text-[10px] md:text-xs font-black uppercase text-slate-500 italic truncate max-w-[80%]">{label}</span>
        {status === 'resolvido' && <CheckCircle className="text-emerald-500 size-4 md:size-[18px]" />}
      </div>

      {!preview ? (
        <label className="flex flex-col items-center justify-center py-4 md:py-6 cursor-pointer hover:bg-slate-50 rounded-lg md:rounded-xl transition-colors">
          <Upload className="text-blue-900 mb-1 md:mb-2 size-5 md:size-6" />
          <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase">CLIQUE PARA ANEXAR</span>
          <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf" />
        </label>
      ) : (
        <div className="relative group">
          {isPdf ? (
            <div className="flex items-center justify-between p-2 md:p-3 bg-white rounded-lg border border-slate-100">
              <div className="flex items-center gap-2 md:gap-3">
                <FileText className="text-red-500 size-5 md:size-6" />
                <span className="text-[9px] md:text-[10px] font-bold truncate max-w-[80px] md:max-w-[100px]">{file?.name || 'Arquivo PDF'}</span>
              </div>
              {existingUrl && (
                <a href={existingUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
                  <Eye className="size-3.5 md:size-4" />
                </a>
              )}
            </div>
          ) : (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full h-24 md:h-32 object-cover rounded-lg shadow-sm" />
              {existingUrl && (
                <a href={existingUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-lg">
                  <Eye className="size-5 md:size-6" />
                </a>
              )}
            </div>
          )}
          {!existingUrl && (
            <button 
              onClick={() => { setPreview(null); setFile(null); }}
              className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="size-3 md:size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
