import React, { useState, useRef } from "react";

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
      className={`bg-slate-800 rounded-xl border p-5 ${required && !loadedCount ? "border-purple-600" : "border-slate-700"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span>📋</span> Manual Test Cases
          {required ? (
            <span className="text-xs text-red-400 font-normal">*required</span>
          ) : (
            <span className="text-xs text-slate-400 font-normal">
              (optional)
            </span>
          )}
        </h2>
        {loadedCount > 0 && (
          <span className="text-xs bg-purple-800/60 text-purple-300 px-2 py-0.5 rounded-full font-medium">
            {loadedCount} tests loaded
          </span>
        )}
      </div>

      {/* Loaded state */}
      {fileName && loadedCount > 0 ? (
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-lg">✅</span>
            <div>
              <div className="text-sm text-green-300 font-medium">
                {fileName}
              </div>
              <div className="text-xs text-slate-400">
                {loadedCount} test cases ready to run
              </div>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-900/20"
          >
            ✕ Remove
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
          className={`border-2 border-dashed rounded-lg px-4 py-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-blue-400 bg-blue-900/20"
              : required
                ? "border-purple-600 hover:border-purple-400 hover:bg-purple-900/10"
                : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/30"
          }`}
        >
          <div className="text-3xl mb-2">📂</div>
          <div className="text-sm text-slate-300 mb-1">
            Drag & drop or{" "}
            <span className="text-blue-400 underline">browse</span>
          </div>
          <div className="text-xs text-slate-500">
            Supports .xlsx · .csv · .json
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
        <div className="mt-2 text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">
          ❌ {error}
        </div>
      )}

      {/* Format guide */}
      {!fileName && (
        <div className="mt-3">
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-300 transition-colors">
              📖 What format should the file be?
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-slate-400 font-medium mb-1">
                  CSV / Excel columns:
                </div>
                <pre className="bg-slate-900 rounded px-3 py-2 text-xs text-green-300 overflow-auto">
                  {`test_name,method,path,body,expected_status
Invalid OTP,POST,/api/v1/auth/verify-otp,{"otp_code":"abcd"},400
Rate limit,POST,/api/v1/auth/send-otp,{"identifier":"8010414088"},429
Get profile,GET,/api/v1/auth/profile,,200`}
                </pre>
              </div>
              <div>
                <div className="text-slate-400 font-medium mb-1">
                  JSON format:
                </div>
                <pre className="bg-slate-900 rounded px-3 py-2 text-xs text-green-300 overflow-auto">
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
