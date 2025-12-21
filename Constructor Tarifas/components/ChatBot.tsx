
import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Volume2, StopCircle, Bot, User, Loader2, Zap } from 'lucide-react';
import { ChatMessage, BusinessPlan } from '../types';
import { chatWithAgent, transcribeAudio, generateSpeech } from '../services/geminiService';

interface ChatBotProps {
  plans: BusinessPlan[];
  clientType?: 'REGULAR' | 'CONVERGENTE';
}

const ChatBot: React.FC<ChatBotProps> = ({ plans, clientType = 'REGULAR' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `¡Hola! Soy tu consultor de Claro Empresas. He detectado que estamos cotizando para un cliente **${clientType}**. ¿En qué puedo ayudarte hoy?`,
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const isConvergent = clientType === 'CONVERGENTE';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      let fullResponseText = '';
      const modelMsgId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, {
        id: modelMsgId,
        role: 'model',
        text: '',
        timestamp: Date.now()
      }]);

      // Ensure history roles match the expected literal types
      const history = messages.map(m => ({ 
        role: m.role as 'user' | 'model', 
        text: m.text 
      }));
      
      // Fix: Explicitly cast clientType to the expected union type to avoid the 'string' vs union error
      const stream = await chatWithAgent(
        userMsg.text, 
        history, 
        plans, 
        clientType as 'REGULAR' | 'CONVERGENTE'
      );

      for await (const chunk of stream) {
        // Fix: chunk.text is a property, not a method
        const text = chunk.text;
        if (text) {
          fullResponseText += text;
          setMessages(prev => prev.map(m => 
            m.id === modelMsgId ? { ...m, text: fullResponseText } : m
          ));
        }
      }
      
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsProcessing(true);
        try {
          const transcription = await transcribeAudio(audioBlob);
          setInputText(prev => (prev ? prev + ' ' + transcription : transcription));
        } finally {
          setIsProcessing(false);
        }
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) { alert("Error micrófono"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePlayTTS = async (messageId: string, text: string) => {
    if (isPlaying === messageId) { setIsPlaying(null); return; }
    setIsProcessing(true);
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        // Initializing AudioContext with the correct sample rate for Gemini TTS (24000Hz)
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        // Manual decoding from base64 to Uint8Array and then from raw PCM to AudioBuffer
        const bytes = decode(base64Audio);
        const audioBuffer = await decodeAudioDataManual(bytes, audioContextRef.current, 24000, 1);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlaying(null);
        source.start(0);
        setIsPlaying(messageId);
      }
    } finally { setIsProcessing(false); }
  };

  // Manual base64 decoding helper
  const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Manual decoding of raw PCM data as recommended for Gemini audio outputs
  const decodeAudioDataManual = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        // Converting 16-bit PCM to float normalized between -1.0 and 1.0
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  return (
    <div className={`flex flex-col h-[600px] bg-slate-900 rounded-2xl border shadow-2xl overflow-hidden transition-all duration-500 ${isConvergent ? 'border-orange-500/50' : 'border-slate-800'}`}>
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isConvergent ? 'bg-orange-500/20 text-orange-500' : 'bg-claro-red/10 text-claro-red'}`}>
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-bold">Consultor IA B2B</h3>
            <p className="text-slate-500 text-xs">Modo: {isConvergent ? 'Convergencia Activa' : 'Venta Regular'}</p>
          </div>
        </div>
        {isConvergent && <Zap size={16} className="text-orange-500 fill-orange-500 animate-pulse" />}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} className={isConvergent ? 'text-orange-500' : 'text-claro-red'} />}
            </div>
            
            <div className={`relative max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>
              <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
              {msg.role === 'model' && msg.text && (
                <button onClick={() => handlePlayTTS(msg.id, msg.text)} className={`absolute -right-8 top-0 p-1.5 text-slate-600 hover:text-white transition-colors ${isPlaying === msg.id ? (isConvergent ? 'text-orange-500' : 'text-claro-red') + ' animate-pulse' : ''}`}>
                  <Volume2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
        {isProcessing && !isRecording && <div className="ml-12 text-xs text-slate-500 flex gap-2"><Loader2 className="animate-spin w-3 h-3"/> Analizando respuesta...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <div className={`flex gap-2 bg-slate-900 p-2 rounded-xl border transition-all ${isConvergent ? 'border-orange-500/30' : 'border-slate-800'}`}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
            placeholder="Pregunta sobre planes o beneficios..."
            className="flex-1 bg-transparent text-slate-200 text-sm resize-none focus:outline-none p-2"
            rows={1}
            disabled={isRecording}
          />
          <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-lg transition-all ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-white'}`}>
            {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
          </button>
          <button onClick={handleSendMessage} disabled={!inputText.trim()} className={`p-2 text-white rounded-lg transition-colors disabled:opacity-50 ${isConvergent ? 'bg-orange-600 hover:bg-orange-700' : 'bg-claro-red hover:bg-red-700'}`}>
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
