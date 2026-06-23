import React, { useState, useEffect } from "react";
import {
  getPublicPortalConfig,
  updatePublicPortalConfig,
  PublicPortalConfig,
} from "../../services/configService";
import {
  Eye,
  Save,
  Palette,
  Shield,
  Copy,
  ExternalLink,
  User,
  Clock,
  Search,
  Plus,
  Trash2,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { PublicPortal } from "../../views/PublicPortal";
import { getPublicOrigin } from "../../lib/urlUtils";
import Swal from "sweetalert2";
import { uploadFile } from "../../services/uploadService";

export const PortalSettingsView = () => {
  const [config, setConfig] = useState<PublicPortalConfig | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const cfg = await getPublicPortalConfig();
      setConfig(cfg);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    try {
      await updatePublicPortalConfig(config);
      Swal.fire("Sucesso", "Portal atualizado com sucesso!", "success");
    } catch (e) {
      Swal.fire("Erro", "Falha ao salvar configurações", "error");
    }
  };

  const handleUpdate = (field: keyof PublicPortalConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const [isValidatingSmtp, setIsValidatingSmtp] = useState(false);
  const handleValidateSmtp = async () => {
    if (!config || !config.smtp_host || !config.smtp_port || !config.smtp_user || !config.smtp_pass) {
      Swal.fire("Atenção", "Preencha todos os campos SMTP (Host, Porta, Usuário, Senha) antes de testar.", "warning");
      return;
    }
    setIsValidatingSmtp(true);
    try {
      const res = await fetch("/api/validate-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.smtp_host,
          port: config.smtp_port,
          user: config.smtp_user,
          pass: config.smtp_pass
        })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire("Sucesso", data.message, "success");
      } else {
        Swal.fire("Erro", data.error || "Erro de conexão SMTP", "error");
      }
    } catch (e: any) {
       Swal.fire("Erro", e.message || "Erro de conexão", "error");
    } finally {
       setIsValidatingSmtp(false);
    }
  };

  const handleAddService = () => {
    if (!config) return;
    const newService = {
      nome_servico: "Novo Serviço",
      icone: "Star",
      subtitulo: "",
      topicos: [],
    };
    setConfig({
      ...config,
      servicos: [...(config.servicos || []), newService],
    });
  };

  const handleUpdateService = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...(config.servicos || [])];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, servicos: updated });
  };

  const handleRemoveService = (index: number) => {
    if (!config) return;
    const updated = (config.servicos || []).filter((_, i) => i !== index);
    setConfig({ ...config, servicos: updated });
  };

  const handleAddPrize = () => {
    if (!config) return;
    const currentPrizes = config.premios || [];
    setConfig({
      ...config,
      premios: [...currentPrizes, { nome: "Novo Prêmio", img: "" }],
    });
  };

  const handleUpdatePrize = (
    index: number,
    key: "nome" | "img",
    value: string,
  ) => {
    if (!config || !config.premios) return;
    const updated = [...config.premios];
    updated[index] = { ...updated[index], [key]: value };
    setConfig({ ...config, premios: updated });
  };

  const handleRemovePrize = (index: number) => {
    if (!config || !config.premios) return;
    const updated = config.premios.filter((_, i) => i !== index);
    setConfig({ ...config, premios: updated });
  };

  const handlePrizeImageUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIndex(index);
    try {
      const reader = new FileReader();
      const base64Url = await new Promise<string>((resolve, reject) => {
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_SIZE = 300;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.onerror = () => reject(new Error("Falha ao ler imagem"));
          img.src = ev.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
        reader.readAsDataURL(file);
      });
      handleUpdatePrize(index, "img", base64Url);
    } catch (err: any) {
      console.error(err);
      Swal.fire(
        "Erro no Upload",
        err.message || "Falha ao processar imagem.",
        "error",
      );
    } finally {
      setUploadingIndex(null);
      e.target.value = "";
    }
  };

  if (!config)
    return (
      <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
        Carregando configurações...
      </div>
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Formulário de Edição */}
      <div className="bg-white dark:bg-slate-900 p-4 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic flex items-center gap-2">
          <Palette size={24} className="text-blue-600" /> Identidade do Portal
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Título do Portal
              </label>
              <input
                type="text"
                value={config.titulo_portal || ""}
                onChange={(e) =>
                  setConfig({ ...config, titulo_portal: e.target.value })
                }
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
                placeholder="Ex: Consulta GSA"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Cor Principal
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="color"
                  value={config.cor_primaria || "#3b82f6"}
                  onChange={(e) =>
                    setConfig({ ...config, cor_primaria: e.target.value })
                  }
                  className="h-10 w-20 rounded cursor-pointer bg-transparent border-none"
                />
                <span className="font-mono text-sm dark:text-slate-300">
                  {config.cor_primaria}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              Boas-vindas (Página Inicial)
            </label>
            <textarea
              value={config.mensagem_boas_vindas || ""}
              onChange={(e) =>
                setConfig({ ...config, mensagem_boas_vindas: e.target.value })
              }
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500/20 h-24 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                WhatsApp Suporte
              </label>
              <input
                type="text"
                value={config.whatsapp_suporte_geral || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    whatsapp_suporte_geral: e.target.value,
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
                placeholder="5511999999999"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                WhatsApp Negociação (Cobrança)
              </label>
              <input
                type="text"
                value={config.whatsapp_negociacao || ""}
                onChange={(e) =>
                  setConfig({ ...config, whatsapp_negociacao: e.target.value })
                }
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
                placeholder="5511999999999"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Bônus Indicação (R$)
              </label>
              <input
                type="number"
                value={config.bonus_indicacao || 0}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    bonus_indicacao: Number(e.target.value),
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Link Vídeo Explicativo
              </label>
              <input
                type="text"
                value={config.link_video_explicativo || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    link_video_explicativo: e.target.value,
                  })
                }
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">E-mail de Boas Vindas Automático</h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Assunto do E-mail</label>
                <input 
                  type="text"
                  value={config.welcome_email_subject || ''}
                  onChange={(e) => setConfig({ ...config, welcome_email_subject: e.target.value })}
                  placeholder="Ex: Bem-vindo à GSA Soluções"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Corpo do E-mail (HTML)</label>
                <textarea 
                  value={config.welcome_email_body || ''}
                  onChange={(e) => setConfig({ ...config, welcome_email_body: e.target.value })}
                  placeholder="<p>Olá {{nome_lead}}, seja bem-vindo!</p>"
                  rows={5}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold dark:text-white focus:ring-2 focus:ring-blue-600 outline-none resize-none font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-2 font-medium">Dica: Use {"{{nome_lead}}"} para inserir o nome do lead dinamicamente no e-mail.</p>
              </div>
            </div>
            <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuração do Servidor de E-mail (SMTP)</h4>
                <button
                  onClick={handleValidateSmtp}
                  disabled={isValidatingSmtp}
                  className="bg-slate-900 border border-slate-800 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                >
                  {isValidatingSmtp && <Loader2 size={14} className="animate-spin" />}
                  {isValidatingSmtp ? "Testando..." : "Testar Conexão SMTP"}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">SMTP Host</label>
                  <input 
                    type="text"
                    value={config.smtp_host || ''}
                    onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                    placeholder="smtp.seudominio.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">SMTP Port</label>
                  <input 
                    type="number"
                    value={config.smtp_port || ''}
                    onChange={(e) => setConfig({ ...config, smtp_port: e.target.value })}
                    placeholder="587"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Usuário SMTP</label>
                  <input 
                    type="text"
                    value={config.smtp_user || ''}
                    onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                    placeholder="contato@seudominio.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Senha SMTP</label>
                  <input 
                    type="password"
                    value={config.smtp_pass || ''}
                    onChange={(e) => setConfig({ ...config, smtp_pass: e.target.value })}
                    placeholder="*********"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold dark:text-white outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CLUBE DE PRÊMIOS */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase italic flex items-center gap-2">
              <ImageIcon size={20} className="text-orange-500" /> Prêmios GSA
            </h3>
            <button
              onClick={handleAddPrize}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(config.premios || []).map((premio, i) => (
              <div
                key={i}
                className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3 relative group"
              >
                <button
                  onClick={() => handleRemovePrize(i)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 z-10 shadow-md"
                >
                  <Trash2 size={12} />
                </button>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Nome do Prêmio
                  </label>
                  <input
                    type="text"
                    value={premio.nome}
                    onChange={(e) =>
                      handleUpdatePrize(i, "nome", e.target.value)
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Imagem (Upload ou URL)
                  </label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={premio.img || ""}
                      onChange={(e) =>
                        handleUpdatePrize(i, "img", e.target.value)
                      }
                      placeholder="https://..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-mono dark:text-white"
                    />
                    <div className="flex items-center gap-2">
                      {premio.img ? (
                        <img
                          src={premio.img}
                          alt={premio.nome}
                          className="w-10 h-10 rounded-lg object-cover bg-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                          <ImageIcon size={16} />
                        </div>
                      )}
                      <label className="flex-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors relative overflow-hidden">
                        {uploadingIndex === i ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 size={12} className="animate-spin" />{" "}
                            Processando...
                          </span>
                        ) : (
                          <span>Procurar Arquivo...</span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePrizeImageUpload(i, e)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={uploadingIndex === i}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!config.premios || config.premios.length === 0) && (
              <p className="text-xs text-slate-400 italic">
                Nenhum prêmio cadastrado. O portal usará valores padrão.
              </p>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleSave}
            className="flex-1 bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            <Save size={18} /> Salvar Alterações
          </button>
          <button
            onClick={() => window.open("/cp", "_blank")}
            className="px-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <Eye size={18} /> Preview
          </button>
        </div>

        {/* Link de Compartilhamento */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/30">
          <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <ExternalLink size={14} /> Link de Consulta Pública
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`${getPublicOrigin()}/cp`}
              className="flex-1 bg-white dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-mono text-slate-600 dark:text-slate-300"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${getPublicOrigin()}/cp`);
                Swal.fire({
                  title: "Copiado!",
                  text: "Link copiado para a área de transferência.",
                  icon: "success",
                  timer: 1500,
                  showConfirmButton: false,
                });
              }}
              className="bg-white dark:bg-slate-800 p-3 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
              title="Copiar Link"
            >
              <Copy size={18} />
            </button>
          </div>
          <p className="text-[9px] text-blue-400 mt-3 italic">
            Compartilhe este link com seus clientes para que eles acompanhem o
            processo.
          </p>
        </div>
      </div>

      {/* Mini Preview em Tempo Real */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-4 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-start overflow-hidden relative min-h-[600px]">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Eye size={12} className="text-blue-600" /> Visualização em Tempo
            Real
          </p>
        </div>

        <div className="w-full h-full origin-top scale-[0.65] mt-8 pointer-events-none select-none">
          <div className="w-[150%] -translate-x-[16.5%]">
            <PublicPortal previewConfig={config} />
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[200px] text-center">
          <p className="text-[9px] text-slate-400 italic">
            Este é um preview interativo. As alterações acima são refletidas
            aqui instantaneamente.
          </p>
        </div>
      </div>
    </div>
  );
};
