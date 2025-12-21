// AI Tool Types for AeroFTP Agent

export type DangerLevel = 'safe' | 'medium' | 'high';

export interface AITool {
    name: string;
    description: string;
    parameters: AIToolParameter[];
    dangerLevel: DangerLevel;
}

export interface AIToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    description: string;
    required: boolean;
}

export interface AgentToolCall {
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'error';
    result?: unknown;
    error?: string;
    preview?: string;
}

// FTP Tools Definition
export const FTP_TOOLS: AITool[] = [
    // 🟢 SAFE - Auto-execute
    {
        name: 'list_files',
        description: 'List files and folders in a directory. Use "remote" or "local" for location.',
        parameters: [
            { name: 'path', type: 'string', description: 'Directory path', required: true },
            { name: 'location', type: 'string', description: '"remote" or "local"', required: true },
        ],
        dangerLevel: 'safe',
    },
    {
        name: 'get_file_info',
        description: 'Get file properties: size, type, modified date',
        parameters: [
            { name: 'path', type: 'string', description: 'File path', required: true },
            { name: 'location', type: 'string', description: '"remote" or "local"', required: true },
        ],
        dangerLevel: 'safe',
    },
    {
        name: 'read_file',
        description: 'Read and display file content (for text files)',
        parameters: [
            { name: 'path', type: 'string', description: 'File path', required: true },
            { name: 'location', type: 'string', description: '"remote" or "local"', required: true },
        ],
        dangerLevel: 'safe',
    },
    {
        name: 'search_files',
        description: 'Search for files by name pattern',
        parameters: [
            { name: 'pattern', type: 'string', description: 'Search pattern (e.g., "*.txt")', required: true },
            { name: 'path', type: 'string', description: 'Directory to search in', required: true },
            { name: 'location', type: 'string', description: '"remote" or "local"', required: true },
        ],
        dangerLevel: 'safe',
    },

    // 🟡 MEDIUM - Requires confirmation
    {
        name: 'download_file',
        description: 'Download file from remote server to local',
        parameters: [
            { name: 'remote_path', type: 'string', description: 'Remote file path', required: true },
            { name: 'local_path', type: 'string', description: 'Local destination path', required: true },
        ],
        dangerLevel: 'medium',
    },
    {
        name: 'upload_file',
        description: 'Upload file from local to remote server',
        parameters: [
            { name: 'local_path', type: 'string', description: 'Local file path', required: true },
            { name: 'remote_path', type: 'string', description: 'Remote destination path', required: true },
        ],
        dangerLevel: 'medium',
    },
    {
        name: 'create_folder',
        description: 'Create a new directory',
        parameters: [
            { name: 'path', type: 'string', description: 'New folder path', required: true },
            { name: 'location', type: 'string', description: '"remote" or "local"', required: true },
        ],
        dangerLevel: 'medium',
    },
    {
        name: 'rename_file',
        description: 'Rename a file or folder',
        parameters: [
            { name: 'old_path', type: 'string', description: 'Current path', required: true },
            { name: 'new_path', type: 'string', description: 'New path/name', required: true },
            { name: 'location', type: 'string', description: '"remote" or "local"', required: true },
        ],
        dangerLevel: 'medium',
    },
    {
        name: 'compare_directories',
        description: 'Compare local and remote directories to find differences',
        parameters: [
            { name: 'local_path', type: 'string', description: 'Local directory path', required: true },
            { name: 'remote_path', type: 'string', description: 'Remote directory path', required: true },
        ],
        dangerLevel: 'medium',
    },

    // 🔴 HIGH - Requires explicit confirmation
    {
        name: 'write_file',
        description: 'Create or overwrite a file with content',
        parameters: [
            { name: 'path', type: 'string', description: 'File path', required: true },
            { name: 'content', type: 'string', description: 'File content', required: true },
            { name: 'location', type: 'string', description: '"remote" or "local"', required: true },
        ],
        dangerLevel: 'high',
    },
    {
        name: 'delete_file',
        description: 'Delete a file or folder',
        parameters: [
            { name: 'path', type: 'string', description: 'Path to delete', required: true },
            { name: 'location', type: 'string', description: '"remote" or "local"', required: true },
        ],
        dangerLevel: 'high',
    },
    {
        name: 'sync_files',
        description: 'Synchronize files between local and remote',
        parameters: [
            { name: 'local_path', type: 'string', description: 'Local directory', required: true },
            { name: 'remote_path', type: 'string', description: 'Remote directory', required: true },
            { name: 'direction', type: 'string', description: '"upload", "download", or "both"', required: true },
        ],
        dangerLevel: 'high',
    },
    {
        name: 'chmod',
        description: 'Change file permissions (remote only)',
        parameters: [
            { name: 'path', type: 'string', description: 'Remote file path', required: true },
            { name: 'mode', type: 'string', description: 'Permission mode (e.g., "755")', required: true },
        ],
        dangerLevel: 'high',
    },
];

// Get tool by name
export const getToolByName = (name: string): AITool | undefined =>
    FTP_TOOLS.find(t => t.name === name);

// Check if tool requires approval
export const requiresApproval = (toolName: string): boolean => {
    const tool = getToolByName(toolName);
    return tool ? tool.dangerLevel !== 'safe' : true;
};

// Generate tool description for AI system prompt
export const generateToolsPrompt = (): string => {
    return `You are AeroAgent, an AI assistant for AeroFTP. You can help users with FTP operations.

AVAILABLE TOOLS:
${FTP_TOOLS.map(t => `- ${t.name}: ${t.description}
  Parameters: ${t.parameters.map(p => `${p.name} (${p.type}${p.required ? ', required' : ''})`).join(', ')}`).join('\n\n')}

IMPORTANT RULES:
1. For safe operations (list, read, search), you can provide results directly.
2. For medium/high risk operations, ALWAYS ask user for confirmation first.
3. Never delete or overwrite files without explicit user request.
4. Always show what you're about to do before doing it.
5. Be helpful and explain what each operation does.

When you want to use a tool, respond with:
TOOL: tool_name
ARGS: {"param1": "value1", "param2": "value2"}

Example:
TOOL: list_files
ARGS: {"path": "/var/www", "location": "remote"}`;
};
