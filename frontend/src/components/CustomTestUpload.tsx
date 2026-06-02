import React, { useState, useRef } from "react";
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle, 
  X, 
  HelpCircle,
  AlertCircle
} from "lucide-react";

interface CustomTestUploadProps {
  onTestsLoaded: (content: string, type: "json" | "csv", count: number) => void;
  onClear: () => void;
  loadedCount: number;
  required?: boolean;
}

export default function CustomTestUpload({
  onTestsLoaded,
  onClear,
  loadedCount,
  required,
}: CustomTestUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!["csv", "json", "xlsx"].includes(ext || "")) {
      setError("Only .csv, .json, or .xlsx files supported");
      return;
    }

    try {
      if (ext === "xlsx") {
        const XLSX = await import(
          "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs" as any
        );
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        const count =
          csv.split("\n").filter((l: string) => l.trim()).length - 1;
        setFileName(file.name);
        onTestsLoaded(csv, "csv", count);
      } else {
        const text = await file.text();
        const type = ext === "json" ? "json" : "csv";
        const count =
          type === "json"
            ? JSON.parse(text).length
            : text.split("\n").filter((l) => l.trim()).length - 1;
        setFileName(file.name);
        onTestsLoaded(text, type, count);
      }
    } catch (err: any) {
      setError(`Could not read file: ${err.message}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleClear = () => {
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
    onClear();
  };

  return (
    <div
      className={`glass-panel rounded-2xl p-5 border shadow-lg relative overflow-hidden transition-all glow-card-hover ${
        required && !loadedCount ? "border-purple-600/60" : "border-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-350 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-purple-400" />
          <span>Manual Test Cases</span>
          {required ? (
            <span className="text-[9px] text-rose-500 font-normal uppercase tracking-wider bg-rose-950/20 border border-rose-900/30 px-2 py-0.5 rounded">*required</span>
          ) : (
            <span className="text-[9px] text-slate-500 font-normal uppercase tracking-wider bg-slate-950/40 px-2 py-0.5 rounded">
              (optional)
            </span>
          )}
        </h2>
        {loadedCount > 0 && (
          <span className="text-[9px] font-extrabold uppercase tracking-widest bg-purple-600/10 border border-purple-500/20 text-purple-400 px-2.5 py-1 rounded-lg">
            {loadedCount} tests loaded
          </span>
        )}
      </div>

      {/* Loaded state details view */}
      {fileName && loadedCount > 0 ? (
        <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl px-4 py-3 flex items-center justify-between shadow">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-xs text-emerald-300 font-bold font-mono">
                {fileName}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium">
                {loadedCount} manual test cases parsed and ready.
              </div>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-rose-400 transition-colors px-2 py-1 rounded hover:bg-rose-900/10 border border-transparent hover:border-rose-900/20"
          >
            Remove File
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-blue-500 bg-blue-500/5 shadow-md shadow-blue-900/5 scale-[0.99]"
              : required
                ? "border-purple-500/40 bg-purple-500/2 hover:border-purple-400 hover:bg-purple-600/5"
                : "border-slate-800 hover:border-slate-600 hover:bg-slate-900/30"
          }`}
        >
          <UploadCloud className={`h-8 w-8 mx-auto mb-2.5 transition-all ${isDragging ? 'text-blue-400 animate-bounce' : 'text-slate-650'}`} />
          <div className="text-xs text-slate-350 mb-1 font-medium">
            Drag & drop spreadsheet or{" "}
            <span className="text-blue-400 font-bold hover:underline">browse</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Supports XLSX · CSV · JSON format
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {error && (
        <div className="mt-3 text-[10px] text-rose-350 bg-rose-955/10 border border-rose-900/40 rounded-xl px-3.5 py-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Structured format details guides */}
      {!fileName && (
        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <details className="text-xs text-slate-500 group">
            <summary className="cursor-pointer hover:text-slate-300 transition-colors flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider outline-none select-none">
              <HelpCircle className="h-3.5 w-3.5 text-slate-550" />
              <span>Spreadsheet Schema Reference</span>
            </summary>
            <div className="mt-3.5 space-y-3.5 animate-fadeIn">
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">CSV Header Schema:</div>
                <pre className="bg-[#040608] rounded-lg px-3 py-2.5 border border-white/[0.04] font-mono text-[9px] text-green-400 overflow-x-auto leading-relaxed">
{`test_name,method,path,body,expected_status
Invalid OTP,POST,/api/v1/otp,{"otp_code":"abcd"},400
Get profile,GET,/api/v1/profile,,200`}
                </pre>
              </div>
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">JSON Array Schema:</div>
                <pre className="bg-[#040608] rounded-lg px-3 py-2.5 border border-white/[0.04] font-mono text-[9px] text-green-400 overflow-x-auto leading-relaxed">
{`[
  {
    "testName": "Invalid OTP",
    "method": "POST",
    "path": "/api/v1/auth/verify-otp",
    "body": { "otp_code": "abcd" },
    "expectedStatus": 400
  }
]`}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
