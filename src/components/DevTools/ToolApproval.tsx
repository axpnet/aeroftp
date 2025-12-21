import React from 'react';
import { Check, X, AlertTriangle, AlertCircle, Info, Loader2, FileText, Folder, Download, Upload, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { AgentToolCall, getToolByName, DangerLevel } from '../../types/tools';

interface ToolApprovalProps {
    toolCall: AgentToolCall;
    onApprove: () => void;
    onReject: () => void;
}

const getDangerStyles = (level: DangerLevel): { bg: string; border: string; icon: React.ReactNode } => {
    switch (level) {
        case 'safe':
            return {
                bg: 'bg-blue-900/30',
                border: 'border-blue-600/50',
                icon: <Info size={16} className="text-blue-400" />
            };
        case 'medium':
            return {
                bg: 'bg-yellow-900/30',
                border: 'border-yellow-600/50',
                icon: <AlertCircle size={16} className="text-yellow-400" />
            };
        case 'high':
            return {
                bg: 'bg-red-900/30',
                border: 'border-red-600/50',
                icon: <AlertTriangle size={16} className="text-red-400" />
            };
    }
};

const getToolIcon = (toolName: string): React.ReactNode => {
    if (toolName.includes('list') || toolName.includes('search')) return <Folder size={14} />;
    if (toolName.includes('download')) return <Download size={14} />;
    if (toolName.includes('upload')) return <Upload size={14} />;
    if (toolName.includes('delete')) return <Trash2 size={14} />;
    if (toolName.includes('write') || toolName.includes('rename')) return <Edit3 size={14} />;
    if (toolName.includes('sync')) return <RefreshCw size={14} />;
    return <FileText size={14} />;
};

export const ToolApproval: React.FC<ToolApprovalProps> = ({ toolCall, onApprove, onReject }) => {
    const tool = getToolByName(toolCall.toolName);
    const dangerLevel = tool?.dangerLevel || 'medium';
    const styles = getDangerStyles(dangerLevel);

    const isExecuting: boolean = toolCall.status === 'executing';
    const isCompleted: boolean = toolCall.status === 'completed';
    const isError: boolean = toolCall.status === 'error';
    const isPending: boolean = toolCall.status === 'pending' || toolCall.status === 'approved';

    return (
        <div className={`rounded-lg border ${styles.border} ${styles.bg} p-3 my-2`}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                {styles.icon}
                <span className="text-xs font-medium text-gray-300">
                    {dangerLevel === 'high' ? '⚠️ High Risk Operation' :
                        dangerLevel === 'medium' ? '🔔 Requires Confirmation' :
                            '📋 Tool Execution'}
                </span>
            </div>

            {/* Tool Info */}
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-gray-800 rounded">
                    {getToolIcon(toolCall.toolName)}
                </div>
                <div>
                    <div className="text-sm font-mono text-white">{toolCall.toolName}</div>
                    {tool && <div className="text-xs text-gray-400">{tool.description}</div>}
                </div>
            </div>

            {/* Arguments */}
            <div className="bg-gray-900/50 rounded p-2 mb-2 font-mono text-xs">
                {Object.entries(toolCall.args).map(([key, value]) => (
                    <div key={key} className="flex">
                        <span className="text-purple-400 mr-2">{key}:</span>
                        <span className="text-gray-300 break-all">{String(value)}</span>
                    </div>
                ))}
            </div>

            {/* Preview if available */}
            {toolCall.preview != null && (
                <div className="text-xs text-gray-400 mb-2 italic">
                    Preview: {String(toolCall.preview)}
                </div>
            )}

            {isExecuting ? (
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Executing...
                </div>
            ) : null}

            {isCompleted ? (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                    <Check size={14} />
                    Completed
                </div>
            ) : null}

            {isError ? (
                <div className="text-red-400 text-sm">
                    ❌ Error: {toolCall.error}
                </div>
            ) : null}

            {isPending && toolCall.status === 'pending' ? (
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={onApprove}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
                    >
                        <Check size={14} />
                        {dangerLevel === 'high' ? 'Confirm Delete' : 'Approve'}
                    </button>
                    <button
                        onClick={onReject}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                    >
                        <X size={14} />
                        Cancel
                    </button>
                </div>
            ) : null}

            {toolCall.result ? (
                <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs text-gray-300 max-h-32 overflow-auto">
                    <pre className="whitespace-pre-wrap">{typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2)}</pre>
                </div>
            ) : null}
        </div>
    );
};

export default ToolApproval;
