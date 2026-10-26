"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size_bytes?: number;
  extension?: string;
  children?: FileNode[];
}

export function RepositoryExplorer({ projectId }: { projectId: string }) {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string>("README.md");
  const [fileContent, setFileContent] = useState<string>("");
  const [fileMeta, setFileMeta] = useState<any>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["", "backend", "frontend"]));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTree();
    loadFile("README.md");
  }, [projectId]);

  const loadTree = async () => {
    setLoadingTree(true);
    try {
      const res = await api.getProjectFiles(projectId, 4);
      if (res.data) {
        setTree(res.data);
      }
    } catch (e) {
      console.error("Failed to load file tree", e);
    } finally {
      setLoadingTree(false);
    }
  };

  const loadFile = async (path: string) => {
    if (!path) return;
    setSelectedPath(path);
    setLoadingContent(true);
    try {
      const res = await api.getProjectFileContent(projectId, path);
      if (res.data) {
        setFileContent(res.data.content || "");
        setFileMeta(res.data);
      } else {
        setFileContent(`// Unable to load ${path}`);
        setFileMeta(null);
      }
    } catch (e) {
      setFileContent(`// Error reading ${path}`);
    } finally {
      setLoadingContent(false);
    }
  };

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderTree = (node: FileNode, depth = 0) => {
    const isDir = node.type === "dir";
    const isExpanded = expandedDirs.has(node.path);
    const isSelected = selectedPath === node.path;

    if (!isDir) {
      return (
        <button
          key={node.path}
          type="button"
          onClick={() => loadFile(node.path)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors text-left ${
            isSelected
              ? "bg-cyan-500/15 text-cyan-300 font-medium"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14)}px` }}
        >
          <FileCode className="w-3.5 h-3.5 shrink-0 text-slate-500" />
          <span className="truncate">{node.name}</span>
          {node.size_bytes ? (
            <span className="ml-auto text-[10px] text-slate-600 font-mono">
              {Math.round(node.size_bytes / 1024)}k
            </span>
          ) : null}
        </button>
      );
    }

    return (
      <div key={node.path || "root"}>
        {node.path !== "" && (
          <button
            type="button"
            onClick={() => toggleDir(node.path)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md text-slate-300 hover:text-white hover:bg-white/[0.04] text-left transition-colors font-medium"
            style={{ paddingLeft: `${Math.max(8, depth * 14)}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            ) : (
              <Folder className="w-3.5 h-3.5 shrink-0 text-cyan-500/70" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
        )}
        {(isExpanded || node.path === "") && node.children && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* Sidebar: File Tree */}
      <div className="md:col-span-4 rounded-xl border border-white/5 bg-white/[0.01] p-3 flex flex-col h-[580px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-cyan-400" /> Workspace Files
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTree}
            disabled={loadingTree}
            className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-3 h-3 ${loadingTree ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
          {loadingTree ? (
            <div className="p-4 text-center text-xs text-slate-500 font-mono">
              Loading workspace tree...
            </div>
          ) : tree ? (
            renderTree(tree)
          ) : (
            <div className="p-4 text-center text-xs text-slate-500 font-mono">
              No files discovered.
            </div>
          )}
        </div>
      </div>

      {/* Main: Contained File Viewer */}
      <div className="md:col-span-8 rounded-xl border border-white/5 bg-black/40 flex flex-col h-[580px] overflow-hidden">
        {/* File Header */}
        <div className="px-4 py-2.5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">{selectedPath}</span>
            {fileMeta && (
              <span className="text-[11px] text-slate-500">
                ({fileMeta.lines_count} lines, {Math.round(fileMeta.size_bytes / 1024)} KB)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* File Body */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 bg-black/30">
          {loadingContent ? (
            <div className="p-8 text-center text-slate-500">Reading file safely...</div>
          ) : (
            <pre className="whitespace-pre-wrap leading-relaxed">
              {fileContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
