import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Sparkles, Settings } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIChatProps {
    className?: string;
}

const AI_MODELS = [
    { id: 'gemini-2.0', name: 'Gemini 2.0 Flash', provider: 'Google', icon: '🚀' },
    { id: 'claude-sonnet', name: 'Claude Sonnet 4', provider: 'Anthropic', icon: '🎭' },
    { id: 'claude-opus', name: 'Claude Opus 4', provider: 'Anthropic (Antigravity)', icon: '🌌' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', icon: '🧠' },
];

export const AIChat: React.FC<AIChatProps> = ({ className = '' }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [selectedModel, setSelectedModel] = useState(AI_MODELS[2]); // Default to Claude Opus (Antigravity!)
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Demo welcome message
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{
                id: '1',
                role: 'assistant',
                content: `👋 Hello! I'm your AI coding assistant powered by **${selectedModel.name}**.

I can help you with:
- 📝 Code explanations and reviews
- 🐛 Debugging and error fixes
- 💡 Suggestions and best practices
- 🔧 File operations and FTP commands

**Phase 4 Feature** - API integration coming soon!`,
                timestamp: new Date(),
            }]);
        }
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Simulate AI response (will be real API later)
        setTimeout(() => {
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `🔜 **API Integration Coming Soon!**

I received your message: "${userMessage.content.substring(0, 50)}${userMessage.content.length > 50 ? '...' : ''}"

This feature will connect to:
- **Google Gemini** (your API key)
- **Anthropic Claude** (via Antigravity)
- **OpenAI GPT-4o**

Stay tuned for Phase 4! 🚀`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            setIsLoading(false);
        }, 1000);
    };

    return (
        <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                    <MessageSquare size={14} className="text-purple-400" />
                    <span className="font-medium">AI Chat</span>
                    <span className="text-yellow-400 text-xs ml-2">Phase 4 Preview</span>
                </div>

                {/* Model Selector */}
                <div className="relative">
                    <button
                        onClick={() => setShowModelSelector(!showModelSelector)}
                        className="flex items-center gap-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                        <span>{selectedModel.icon}</span>
                        <span>{selectedModel.name}</span>
                    </button>

                    {showModelSelector && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-10 py-1 min-w-[200px]">
                            {AI_MODELS.map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => { setSelectedModel(model); setShowModelSelector(false); }}
                                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-700 flex items-center gap-2 ${selectedModel.id === model.id ? 'text-purple-400' : 'text-gray-300'
                                        }`}
                                >
                                    <span>{model.icon}</span>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{model.name}</span>
                                        <span className="text-gray-500 text-[10px]">{model.provider}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {messages.map(message => (
                    <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                    >
                        {message.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center shrink-0">
                                <Bot size={16} className="text-purple-400" />
                            </div>
                        )}
                        <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${message.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-200'
                                }`}
                        >
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            <div className={`text-[10px] mt-1 ${message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                                }`}>
                                {message.timestamp.toLocaleTimeString()}
                            </div>
                        </div>
                        {message.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                                <User size={16} className="text-blue-400" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center shrink-0">
                            <Sparkles size={16} className="text-purple-400 animate-pulse" />
                        </div>
                        <div className="bg-gray-800 rounded-lg px-4 py-2 text-gray-400 text-sm">
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder="Ask about code, FTP, or anything..."
                        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChat;
