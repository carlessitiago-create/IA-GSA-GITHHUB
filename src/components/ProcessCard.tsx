import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { generateProcessPdf } from '../services/pdfService';
import { ChevronDown, ChevronUp, AlertCircle, Download, Edit2, MessageCircle, RefreshCw, Plus, Search, Trash2, CheckCircle2, Clock, MessageSquare, ArrowRight, History, ShieldCheck, User, Briefcase, Calendar, FileText, ExternalLink, ChevronRight, DollarSign, Info, MoreVertical, Phone, Send, AlertTriangle, CheckCircle, Package, FileSearch, Activity, Zap, Clock3, Target, TrendingUp, BarChart3, Layers, HelpCircle, ClipboardCheck, UserCheck, Truck, Eye, Share2, Clock4, CalendarDays, FileCheck, FileWarning, AlertOctagon, Check, X, Edit3, Trash, Save, ArrowLeft, LayoutDashboard, Users, Settings, LogOut, Menu, Bell, Filter, FilePlus, FileMinus, FileEdit, FileSearch2, ClipboardList, ListChecks, Shield, Lock, Unlock, Key, Mail, MapPin, Globe, Link, Image, Video, Music, Mic, Camera, Monitor, Smartphone, Tablet, Laptop, Watch, Tv, Speaker, Headphones, Bluetooth, Wifi, Battery, Cpu, HardDrive, Database, Cloud, Server, Code, Terminal, Bug, GitBranch, GitCommit, GitMerge, GitPullRequest, Github, Twitter, Facebook, Instagram, Linkedin, Youtube, Slack, Trello, Figma, Chrome, Framer, Dribbble, Codepen, Twitch, Play, Pause, StopCircle, SkipBack, SkipForward, Volume2, VolumeX, Sun, Moon, CloudRain, CloudLightning, CloudSnow, Wind, Droplets, Thermometer, Compass, Navigation, Map, Flag, Anchor, LifeBuoy, ShoppingBag, ShoppingCart, CreditCard, Wallet, Gift, Award, Medal, Trophy, Star, Heart, ThumbsUp, ThumbsDown, Smile, Meh, Frown, Ghost, Skull, Flame, ZapOff, Lightbulb, Umbrella, Coffee, Beer, Wine, Pizza, Apple, Car, Bike, Plane, Rocket, Train, Bus, Footprints, TreePine, Mountain, Waves, Sunrise, Sunset, CameraOff, VideoOff, MicOff, EyeOff, LockKeyhole, ShieldAlert, ShieldQuestion, ShieldX, Fingerprint, Scan, QrCode, Barcode, Hash, AtSign, Paperclip } from 'lucide-react';
import { OrderProcess } from '../services/orderService';
import { UserProfile } from '../services/userService';
import { formatDate as formatAppDate, formatDateTime as formatAppDateTime } from '../lib/dateUtils';
import { PROCESS_REQUIREMENTS } from '../constants/processRequirements';
import { useRequirements } from '../hooks/useRequirements';

import { AuditoriaProcesso } from './GSA/AuditoriaProcesso';
import { ProcessDetailModal } from './GSA/ProcessDetailModal';
import { SmartFicha } from './GSA/SmartFicha';

interface ProcessCardProps {
  proc: OrderProcess;
  pendencies: any[];
  history: any[];
  allUsers?: UserProfile[];
  userRole?: string;
  clienteData?: any;
  onEdit?: (proc: OrderProcess) => void;
  onSetWhatsApp?: (proc: OrderProcess) => void;
  onStatusChange?: (proc: OrderProcess) => void;
  onUpdate?: () => void;
  models?: Record<string, any>;
}

export const ProcessCard: React.FC<ProcessCardProps> = ({ proc, pendencies, history, allUsers, userRole, clienteData, models, onEdit, onSetWhatsApp, onStatusChange, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSmartFicha, setShowSmartFicha] = useState(false);
  const { config: requirementsConfig } = useRequirements();

  const myHistory = history
    .filter(h => h.processo_id === proc.id)
    .sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return timeB - timeA;
    });

  // Calculate status-based progress
  const calculateProgress = () => {
    // 1. Base progress from status
    let baseProgress = 0;
    switch (proc.status_atual) {
      case 'Concluído': baseProgress = 100; break;
      case 'Em Andamento': baseProgress = 75; break;
      case 'Aguardando Documentação': baseProgress = 50; break;
      case 'Aguardando Aprovação': baseProgress = 15; break;
      case 'Em Análise': baseProgress = 25; break;
      case 'Pendente': baseProgress = 10; break;
      default: baseProgress = 0;
    }

    // 2. If we have requirements and client data, calculate based on completion
    const req = (proc.dados_faltantes && proc.pendencias_iniciais && 
                (proc.dados_faltantes.length > 0 || proc.pendencias_iniciais.length > 0))
      ? { campos: proc.dados_faltantes, documentos: proc.pendencias_iniciais }
      : models?.[proc.servico_id] || PROCESS_REQUIREMENTS[proc.servico_id];

    if (clienteData && proc.servico_id && req) {
      const totalItems = req.campos.length + req.documentos.length;
      
      if (totalItems > 0) {
        let completedItems = 0;
        
        // Check fields
        req.campos.forEach((campo: string) => {
          if (clienteData[campo]) completedItems++;
        });
        
        // Check documents
        req.documentos.forEach((doc: string) => {
          if (clienteData[doc] || proc[`check_${doc}`]) completedItems++;
        });
        
        const reqProgress = (completedItems / totalItems) * 100;
        
        // Blend status progress with requirement progress
        if (proc.status_atual === 'Concluído') return 100;
        return Math.round((baseProgress * 0.4) + (reqProgress * 0.6));
      }
    }

    return baseProgress;
  };

  const progressPercent = calculateProgress();
  
  // Sinalizador de Prontidão
  const getReadinessSignal = () => {
    const req = (proc.dados_faltantes && proc.pendencias_iniciais && 
                (proc.dados_faltantes.length > 0 || proc.pendencias_iniciais.length > 0))
      ? { campos: proc.dados_faltantes, documentos: proc.pendencias_iniciais }
      : models?.[proc.servico_id] || PROCESS_REQUIREMENTS[proc.servico_id];

    if (!clienteData || !proc.servico_id || !req) return null;
    
    const totalFields = req.campos.length;
    const totalDocs = req.documentos.length;
    
    let filledFields = 0;
    req.campos.forEach((c: string) => { if (clienteData[c]) filledFields++; });
    
    let filledDocs = 0;
    req.documentos.forEach((d: string) => { if (clienteData[d] || proc[`check_${d}`]) filledDocs++; });
    
    const fieldsPercent = totalFields > 0 ? (filledFields / totalFields) * 100 : 100;
    const docsPercent = totalDocs > 0 ? (filledDocs / totalDocs) * 100 : 100;
    
    if (fieldsPercent === 100 && docsPercent === 100) {
      return { color: 'bg-emerald-500', label: 'Pronto para Início' };
    }
    
    if (fieldsPercent > 0 || docsPercent > 0) {
      return { color: 'bg-amber-500', label: 'Aguardando Documentos' };
    }
    
    return { color: 'bg-rose-500', label: 'Dados Inexistentes' };
  };

  const readiness = getReadinessSignal();

  // Determine progress color
  const getProgressColor = (percent: number) => {
    if (percent === 100) return '#10b981'; // Green
    if (percent >= 75) return '#3b82f6'; // Blue
    if (percent >= 50) return '#f59e0b'; // Amber
    return '#64748b'; // Slate
  };

  // Check for urgent pendencies (older than 3 days)
  const hasUrgentPendency = pendencies.some(p => {
    if (p.processo_id !== proc.id || p.status_pendencia === 'RESOLVIDO') return false;
    const created = p.timestamp?.toDate ? p.timestamp.toDate().getTime() : new Date(p.timestamp).getTime();
    const diff = new Date().getTime() - created;
    return diff > 3 * 24 * 60 * 60 * 1000;
  });

  const statusColor = 
    proc.status_atual === 'Concluído' ? 'border-emerald-500' :
    proc.status_atual === 'Aguardando Aprovação' ? 'border-amber-500' :
    proc.status_atual === 'Em Andamento' ? 'border-blue-600' :
    proc.status_atual === 'Aguardando Documentação' ? 'border-orange-500' :
    'border-slate-400';

  const canShowSmartFicha = (proc.status_atual === 'Pendente' || proc.status_atual === 'Aguardando Documentação') && 
                            ((proc.dados_faltantes && proc.dados_faltantes.length > 0) || 
                             (proc.pendencias_iniciais && proc.pendencias_iniciais.length > 0));

  const handleWhatsAppSupport = () => {
    if (!proc.whatsapp_suporte) {
      alert('Número de suporte não configurado para este processo.');
      return;
    }
    const number = proc.whatsapp_suporte.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá, preciso de ajuda com o processo ${proc.servico_nome} (Protocolo ${proc.protocolo || `#${proc.venda_id.slice(0, 8)}`}).`);
    window.open(`https://wa.me/${number}?text=${text}`, '_blank');
  };

  const handleWhatsAppPendency = () => {
    if (!proc.whatsapp_suporte) {
      alert('Número de suporte não configurado para este processo.');
      return;
    }
    const number = proc.whatsapp_suporte.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá, estou enviando a pendência referente ao processo ${proc.servico_nome} (Protocolo ${proc.protocolo || `#${proc.venda_id.slice(0, 8)}`}).`);
    window.open(`https://wa.me/${number}?text=${text}`, '_blank');
  };

  const activePendencies = pendencies.filter(p => p.processo_id === proc.id && p.status_pendencia !== 'RESOLVIDO');
  const hasActivePendency = activePendencies.length > 0;

  return (
    <motion.div 
      layout
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 ${statusColor}`}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm">{proc.servico_nome}</h4>
            {proc.cliente_nome && (
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">{proc.cliente_nome}</p>
            )}
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Protocolo {proc.protocolo || `#${proc.venda_id.slice(0, 8)}`}</p>
            {readiness && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className={`size-1.5 rounded-full ${readiness.color} animate-pulse`} />
                <span className={`text-[7px] font-black uppercase tracking-widest ${readiness.color.replace('bg-', 'text-')}`}>
                  {readiness.label}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${
              proc.status_atual === 'Concluído' ? 'bg-emerald-50 text-emerald-700' :
              proc.status_atual === 'Aguardando Aprovação' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
              proc.status_atual === 'Em Andamento' ? 'bg-blue-50 text-blue-700' :
              proc.status_atual === 'Em Análise' ? 'bg-amber-50 text-amber-700' :
              proc.status_atual === 'Aguardando Documentação' ? 'bg-orange-50 text-orange-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {proc.status_atual}
            </span>
            {userRole?.startsWith('ADM') && (
              <div className="flex gap-1">
                {onStatusChange && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(proc);
                    }}
                    className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                    title="Alterar Status"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(proc);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                  title="Editar Processo"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {proc.status_info_extra && (
          <div className="mb-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
             <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Nota de Status:</p>
             <p className="text-[10px] text-slate-700 dark:text-slate-300 italic">{proc.status_info_extra}</p>
          </div>
        )}

        {hasActivePendency && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-tight">
                  Atenção: Pendência Ativa
                </p>
                <p className="text-[10px] text-red-600 dark:text-red-300 mt-1 font-medium">
                  O processo só poderá dar continuidade após a resolução desta pendência.
                </p>
                {activePendencies.map((p, i) => (
                  <div key={i} className="mt-2 p-3 bg-white/50 dark:bg-black/20 rounded-lg space-y-2">
                    <p className="text-[10px] font-bold text-red-800 dark:text-red-200 uppercase tracking-wider">{p.titulo_pendencia || p.titulo}</p>
                    <p className="text-[10px] text-red-700 dark:text-red-300 italic">
                      {userRole === 'CLIENTE' ? (p.mensagem_publica || p.descricao_pendencia || p.descricao) : (p.descricao_pendencia || p.mensagem_interna || p.descricao)}
                    </p>
                    
                    {/* Detalhes da Pendência (Apenas para Equipe Interna) */}
                    {userRole !== 'CLIENTE' && (
                      <div className="pt-2 border-t border-red-200/30 space-y-2">
                        <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">Detalhes da Pendência</p>
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <p className="text-[8px] font-bold text-red-500 uppercase">Mensagem Interna</p>
                            <p className="text-[9px] text-red-800 dark:text-red-200">{p.mensagem_interna || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-bold text-red-500 uppercase">Mensagem Pública</p>
                            <p className="text-[9px] text-red-800 dark:text-red-200">{p.mensagem_publica || 'N/A'}</p>
                          </div>
                          {(userRole === 'ADM_MASTER' || userRole === 'ADM_GERENTE') && (
                            <div>
                              <p className="text-[8px] font-bold text-red-500 uppercase">Observação ADM Privada</p>
                              <p className="text-[9px] text-red-800 dark:text-red-200">{p.observacao_adm || 'N/A'}</p>
                            </div>
                          )}
                          {p.anexo_url && (
                            <div>
                              <p className="text-[8px] font-bold text-red-500 uppercase">Anexo</p>
                              <a href={p.anexo_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-600 hover:underline flex items-center gap-1">
                                <Paperclip size={10} /> Ver Anexo
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
            <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-slate-400">Progresso do Processo</span>
              <span className="text-xs font-black">{progressPercent}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowDetailModal(true)} 
                className="text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest hover:underline"
              >
                Ver Detalhes
              </button>
              <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="text-slate-900 dark:text-slate-100 text-xs font-bold hover:underline"
              >
                {isExpanded ? 'Ver Menos' : 'Auditoria'}
              </button>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <motion.div 
              className="h-full"
              initial={{ width: 0 }}
              animate={{ 
                width: `${progressPercent}%`,
                backgroundColor: getProgressColor(progressPercent)
              }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          </div>
        </div>

        {proc.status_atual === 'Concluído' && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors">
              <Download size={16} /> DOWNLOAD FINAL
            </button>
          </div>
        )}

        {canShowSmartFicha && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => setShowSmartFicha(true)}
              className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
            >
              <ClipboardList size={16} /> RESOLVER PENDÊNCIAS AGORA
            </button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={() => generateProcessPdf(proc)}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Download size={16} /> GERAR PDF DO PROCESSO
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4"
          >
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
              {/* Ficha de Auditoria (Apenas para ADM Analista ou Master) */}
              {(userRole?.startsWith('ADM')) && clienteData && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <AuditoriaProcesso processo={proc} clienteData={clienteData} onUpdate={onUpdate} models={models} />
                </div>
              )}

              {/* Informações de Auditoria */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Valor de Venda</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">R$ {proc.preco_venda.toLocaleString('pt-BR')}</p>
                </div>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                  <p className="text-[8px] font-black text-emerald-600 uppercase">Proposta Aceita</p>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">R$ {(proc.valor_proposta_aceita || proc.preco_venda).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {proc.detalhes_negociacao && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                  <p className="text-[8px] font-black text-blue-600 uppercase mb-1">Negociação</p>
                  <p className="text-[10px] text-blue-800 dark:text-blue-300">{proc.detalhes_negociacao}</p>
                </div>
              )}

              {proc.proposta_enviada_url && (
                <a 
                  href={proc.proposta_enviada_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full p-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                >
                  <Download size={14} /> VER PROPOSTA ENVIADA
                </a>
              )}

              {/* Controle de Status de Fatura (ADM) */}
              {userRole?.startsWith('ADM') && (
                <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Controle Financeiro ADM</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={async () => {
                        const { atualizarStatusFatura } = await import('../services/financialService');
                        const Swal = (await import('sweetalert2')).default;
                        await atualizarStatusFatura(proc, 'PAGO', 0);
                        Swal.fire('Sucesso', 'Fatura marcada como PAGA e processo retomado.', 'success');
                        if (onUpdate) onUpdate();
                      }}
                      className="p-2 bg-emerald-600 text-white rounded-lg text-[9px] font-bold hover:bg-emerald-700 transition-all"
                    >
                      MARCAR COMO PAGO
                    </button>
                    <button 
                      onClick={async () => {
                        const Swal = (await import('sweetalert2')).default;
                        const { value: dias } = await Swal.fire({
                          title: 'Dias de Atraso',
                          input: 'number',
                          inputLabel: 'Informe os dias de atraso',
                          inputValue: 11,
                          showCancelButton: true
                        });
                        if (dias) {
                          const { atualizarStatusFatura } = await import('../services/financialService');
                          await atualizarStatusFatura(proc, 'VENCIDO', Number(dias));
                          Swal.fire('Sucesso', 'Fatura marcada como VENCIDA e processo suspenso.', 'warning');
                          if (onUpdate) onUpdate();
                        }
                      }}
                      className="p-2 bg-rose-600 text-white rounded-lg text-[9px] font-bold hover:bg-rose-700 transition-all"
                    >
                      MARCAR ATRASO
                    </button>
                  </div>
                  
                  <button 
                    onClick={async () => {
                      const { gerarRelatorioStatus } = await import('../services/statusPdfService');
                      const { getPublicPortalConfig } = await import('../services/configService');
                      const config = await getPublicPortalConfig();
                      gerarRelatorioStatus(proc, config?.whatsapp_negociacao || config?.whatsapp_suporte_geral);
                    }}
                    className={`w-full p-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-sm ${
                      proc.status_financeiro === 'VENCIDO' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
                    }`}
                  >
                    <FileText size={14} /> 
                    {proc.status_financeiro === 'VENCIDO' ? 'Gerar Notificação Extrajudicial' : 'Gerar Relatório de Status'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-[10px]">
                {allUsers && proc.vendedor_id && (
                  <div className="col-span-2 p-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <p className="text-slate-400 uppercase font-bold text-[8px]">Vendedor</p>
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                          {allUsers.find(u => u.uid === proc.vendedor_id)?.nome_completo || 'N/A'}
                        </p>
                      </div>
                      <div className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold text-[8px]">
                        PROPOSTA ACEITA
                      </div>
                      {allUsers.find(u => u.uid === proc.vendedor_id)?.id_superior && (
                        <div className="text-right">
                          <p className="text-slate-400 uppercase font-bold text-[8px]">Gestor</p>
                          <p className="font-bold text-slate-700 dark:text-slate-300">
                            {allUsers.find(u => u.uid === allUsers.find(u => u.uid === proc.vendedor_id)?.id_superior)?.nome_completo || 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-slate-400 uppercase font-bold">Prazo Estimado</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{proc.prazo_estimado_dias} dias úteis</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase font-bold">Previsão</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{formatAppDate(new Date(proc.data_inicial?.toDate().getTime() + proc.prazo_estimado_dias * 24 * 60 * 60 * 1000))}</p>
                </div>
              </div>

              {/* WhatsApp Support Buttons */}
              <div className="pt-2 space-y-2">
                {proc.whatsapp_suporte ? (
                  userRole === 'CLIENTE' ? (
                    <button 
                      onClick={handleWhatsAppPendency}
                      className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#25D366]/20"
                    >
                      <MessageCircle size={16} />
                      ENVIAR PENDÊNCIA (WHATSAPP)
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleWhatsAppSupport}
                        className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#25D366]/20"
                      >
                        <MessageCircle size={16} />
                        SUPORTE (WHATSAPP)
                      </button>
                      {onSetWhatsApp && (
                        <button 
                          onClick={() => onSetWhatsApp(proc)}
                          className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                          title="Configurar Número"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  onSetWhatsApp && userRole !== 'CLIENTE' && (
                    <button 
                      onClick={() => onSetWhatsApp(proc)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <MessageCircle size={16} />
                      CONFIGURAR WHATSAPP SUPORTE
                    </button>
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProcessDetailModal 
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        process={proc}
        history={history}
        clienteData={clienteData}
      />

      {/* Modal SmartFicha */}
      <AnimatePresence>
        {showSmartFicha && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative border border-slate-100 dark:border-slate-800"
            >
              <button 
                onClick={() => setShowSmartFicha(false)}
                className="absolute top-6 right-6 z-50 size-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 transition-all"
              >
                <X size={20} />
              </button>

              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center gap-4">
                <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Resolver Pendências</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complete as informações para o processo {proc.servico_nome}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <SmartFicha 
                  processos={[proc]} 
                  clienteDados={clienteData} 
                  onUpdate={() => {
                    setShowSmartFicha(false);
                    if (onUpdate) onUpdate();
                  }} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
