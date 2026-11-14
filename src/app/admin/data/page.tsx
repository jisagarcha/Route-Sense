"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, FileText, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import {
  getLocationCSVTemplate,
  getRoadCSVTemplate,
  downloadCSV,
  readFileAsText,
} from "@/lib/csv-utils";

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
  warnings: string[];
  duplicates: string[];
}

export default function DataManagementPage() {
  const [importType, setImportType] = useState<"locations" | "roads">("locations");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        setError("Please select a CSV file");
        return;
      }
      setSelectedFile(file);
      setError(null);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setIsImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const csvData = await readFileAsText(selectedFile);

      const response = await fetch(`/api/import/${importType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData, skipDuplicates }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setImportResult(data);
        } else {
          setError(data.error || "Failed to import data");
        }
      } else {
        setImportResult(data);
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById("file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch (err) {
      console.error("Import error:", err);
      setError("Failed to import data. Please check your file format.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportDataset = async (type: string, defaultName: string) => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(`/api/export?type=${type}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || `Failed to export ${type} data`);
        return;
      }

      const csvContent = await response.text();
      const filename = `${defaultName}_${new Date().toISOString().split("T")[0]}.csv`;
      downloadCSV(csvContent, filename);
    } catch (err) {
      console.error("Export error:", err);
      setError(`Failed to export ${type} data`);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTemplate = () => {
    const template =
      importType === "locations" ? getLocationCSVTemplate() : getRoadCSVTemplate();
    const filename = `${importType}_template.csv`;
    downloadCSV(template, filename);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Management</h1>
        <p className="text-muted-foreground mt-2">
          Import and export locations and roads in CSV format
        </p>
      </div>

      {/* Data Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Data Type</CardTitle>
          <CardDescription>Select the type of data to manage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="data-type">Type</Label>
            <Select
              value={importType}
              onValueChange={(value) => {
                setImportType(value as "locations" | "roads");
                setSelectedFile(null);
                setImportResult(null);
                setError(null);
              }}
            >
              <SelectTrigger id="data-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="locations">Locations</SelectItem>
                <SelectItem value="roads">Roads</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* CSV Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Template
          </CardTitle>
          <CardDescription>
            Download a template file to see the required format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download {importType} Template
          </Button>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </CardTitle>
          <CardDescription>Upload a CSV file to import {importType}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div>
            <Label htmlFor="file-input">CSV File</Label>
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full mt-2 text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Duplicate Handling */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="skip-duplicates"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="skip-duplicates" className="cursor-pointer">
              Skip duplicates (don&apos;t update existing records)
            </Label>
          </div>

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!selectedFile || isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>Processing...</>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {importType}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Business Intelligence & Data Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Operations & Business Intelligence Reports
          </CardTitle>
          <CardDescription>
            Download granular operational reports in CSV format for analysis in Excel, PowerBI, or Tableau.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Deliveries Report */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900 mb-1">🚚 Delivery Routes & Variance</div>
                <p className="text-xs text-slate-600 mb-4">
                  Full route logs with planned vs. actual duration, delays, distances, and driver completion stats.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportDataset("deliveries", "delivery_routes")}
                disabled={isExporting}
                className="w-full text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export Deliveries CSV
              </Button>
            </div>

            {/* 2. Items & Returns Report */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900 mb-1">📦 Stop Outcomes & Return Diagnostics</div>
                <p className="text-xs text-slate-600 mb-4">
                  Granular item-level statuses, recipient details, and failure or return reasons recorded by drivers.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportDataset("items", "delivery_items_diagnostics")}
                disabled={isExporting}
                className="w-full text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export Items CSV
              </Button>
            </div>

            {/* 3. Drivers Report */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900 mb-1">👤 Driver Fleet Utilization</div>
                <p className="text-xs text-slate-600 mb-4">
                  Driver vehicle profiles, capacity limits (kg/cu ft), ratings, experience, and delivery totals.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportDataset("drivers", "driver_fleet")}
                disabled={isExporting}
                className="w-full text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export Drivers CSV
              </Button>
            </div>

            {/* 4. Locations Report */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900 mb-1">📍 Delivery Locations Network</div>
                <p className="text-xs text-slate-600 mb-4">
                  Full catalog of geocoded delivery locations, hub names, and latitude/longitude coordinates.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportDataset("locations", "locations")}
                disabled={isExporting}
                className="w-full text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export Locations CSV
              </Button>
            </div>

            {/* 5. Roads Graph Report */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900 mb-1">🛣️ Road Adjacency & Distance Graph</div>
                <p className="text-xs text-slate-600 mb-4">
                  Connected road network segments, bidirectional connectivity, and road segment distances.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportDataset("roads", "roads")}
                disabled={isExporting}
                className="w-full text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export Roads CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </Alert>
      )}

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">
                  {importResult.imported}
                </div>
                <div className="text-sm text-green-600">Successfully Imported</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">
                  {importResult.skipped}
                </div>
                <div className="text-sm text-yellow-600">Skipped</div>
              </div>
            </div>

            {/* Duplicates */}
            {importResult.duplicates.length > 0 && (
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Duplicates Found ({importResult.duplicates.length})
                </h4>
                <div className="max-h-40 overflow-y-auto bg-yellow-50 p-3 rounded-md">
                  <ul className="text-sm space-y-1">
                    {importResult.duplicates.map((dup, idx) => (
                      <li key={idx} className="text-yellow-800">
                        • {dup}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Warnings */}
            {importResult.warnings.length > 0 && (
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Warnings ({importResult.warnings.length})
                </h4>
                <div className="max-h-40 overflow-y-auto bg-yellow-50 p-3 rounded-md">
                  <ul className="text-sm space-y-1">
                    {importResult.warnings.map((warning, idx) => (
                      <li key={idx} className="text-yellow-800">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Validation Errors ({importResult.errors.length})
                </h4>
                <div className="max-h-60 overflow-y-auto bg-red-50 p-3 rounded-md">
                  <ul className="text-sm space-y-2">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx} className="text-red-800">
                        <strong>Row {err.row}, Field &quot;{err.field}&quot;:</strong> {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
