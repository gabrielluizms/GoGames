import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import Draggable from 'react-draggable';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Plus, Trash2, Move, Save, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configurar worker do PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const AVAILABLE_VARIABLES = [
  { value: '@client_name', label: 'Nome do Cliente' },
  { value: '@cpf', label: 'CPF' },
  { value: '@address', label: 'Endereço' },
  { value: '@city_uf', label: 'Cidade/UF' },
  { value: '@cep', label: 'CEP' },
  { value: '@phone', label: 'Telefone' },
  { value: '@email', label: 'E-mail' },
  { value: '@birthday_person_name', label: 'Nome do Aniversariante' },
  { value: '@age_to_complete', label: 'Idade' },
  { value: '@event_date', label: 'Data do Evento' },
  { value: '@start_time', label: 'Hora Início' },
  { value: '@end_time', label: 'Hora Fim' },
  { value: '@room', label: 'Salão(ões)' },
  { value: '@party_theme', label: 'Tema da Festa' },
  { value: '@balloon_color', label: 'Cor dos Balões' },
  { value: '@base_value', label: 'Valor Base' },
  { value: '@total_value', label: 'Valor Total' },
  { value: '@payment_method', label: 'Forma de Pagamento' },
  { value: '@extras', label: 'Extras Detalhados' },
];

// Componente individual para campo draggable e redimensionável
const DraggableResizableField = ({ field, scale, selectedField, onSelect, onPositionChange, onResize }) => {
  const nodeRef = useRef(null);
  const isSelected = selectedField === field.id;

  return (
    <Draggable
      nodeRef={nodeRef}
      position={{ x: field.x * scale, y: field.y * scale }}
      onStop={(e, data) => onPositionChange(field.id, data.x, data.y)}
      bounds="parent"
      cancel=".resize-handle"
    >
      <div
        ref={nodeRef}
        className={`absolute cursor-move rounded border-2 transition-colors ${
          isSelected 
            ? 'border-blue-500 bg-blue-100/90' 
            : 'border-orange-400 bg-orange-100/90'
        }`}
        style={{ 
          zIndex: isSelected ? 20 : 10,
          top: 0,
          left: 0,
          width: (field.width || 150) * scale,
          height: (field.height || 30) * scale,
          minWidth: 50 * scale,
          minHeight: 20 * scale,
        }}
        onClick={() => onSelect(field.id)}
      >
        {/* Área principal com o nome da variável */}
        <div 
          className="flex items-start gap-1 p-1 h-full overflow-hidden"
          style={{ 
            fontSize: `${Math.max(8, field.fontSize * scale * 0.8)}px`,
          }}
        >
          <Move className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
          <span className="font-mono text-xs break-all" style={{ fontWeight: field.bold ? 'bold' : 'normal' }}>
            {field.variable}
          </span>
        </div>
        
        {/* Alça de redimensionamento */}
        {isSelected && (
          <div
            className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-blue-500 rounded-tl-md flex items-center justify-center"
            onMouseDown={(e) => {
              e.stopPropagation();
              const startX = e.clientX;
              const startY = e.clientY;
              const startWidth = field.width || 150;
              const startHeight = field.height || 30;
              
              const onMouseMove = (moveEvent) => {
                const deltaX = (moveEvent.clientX - startX) / scale;
                const deltaY = (moveEvent.clientY - startY) / scale;
                const newWidth = Math.max(50, startWidth + deltaX);
                const newHeight = Math.max(20, startHeight + deltaY);
                onResize(field.id, newWidth, newHeight);
              };
              
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              };
              
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            }}
          >
            <Maximize2 className="w-2 h-2 text-white rotate-90" />
          </div>
        )}
      </div>
    </Draggable>
  );
};

const ContractPdfEditor = ({ token, API, pdfBase, pdfFields, onSave }) => {
  const [pdfData, setPdfData] = useState(pdfBase || null);
  const [fields, setFields] = useState(pdfFields || []);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1);
  const [selectedField, setSelectedField] = useState(null);
  const [newFieldVariable, setNewFieldVariable] = useState('@client_name');
  const [newFieldFontSize, setNewFieldFontSize] = useState(10);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Calcular escala baseada no container
  useEffect(() => {
    const calculateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 40;
        const newScale = Math.min(containerWidth / 595, 1);
        setScale(newScale);
      }
    };
    
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [pdfData]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 5MB');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result.split(',')[1];
        setPdfData(base64);
        setFields([]); // Limpar campos ao trocar PDF
        toast.success('PDF carregado com sucesso!');
      };
      reader.onerror = () => {
        toast.error('Erro ao ler o arquivo PDF');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast.error('Erro ao carregar PDF');
    }
  };

  const addField = () => {
    try {
      const newField = {
        id: Date.now().toString(),
        variable: newFieldVariable,
        x: 50,
        y: 100,
        width: newFieldVariable === '@extras' ? 300 : 150, // Largura maior para extras
        height: newFieldVariable === '@extras' ? 60 : 25,  // Altura maior para extras
        fontSize: newFieldFontSize,
        bold: false,
      };
      setFields(prevFields => [...prevFields, newField]);
      setSelectedField(newField.id);
      toast.success('Campo adicionado! Arraste para posicionar e redimensione conforme necessário.');
    } catch (error) {
      console.error('Error adding field:', error);
      toast.error('Erro ao adicionar campo');
    }
  };

  const removeField = (fieldId) => {
    try {
      setFields(prevFields => prevFields.filter(f => f.id !== fieldId));
      if (selectedField === fieldId) setSelectedField(null);
      toast.success('Campo removido');
    } catch (error) {
      console.error('Error removing field:', error);
      toast.error('Erro ao remover campo');
    }
  };

  const updateFieldPosition = (fieldId, x, y) => {
    setFields(prevFields => prevFields.map(f => 
      f.id === fieldId ? { ...f, x: Math.round(x / scale), y: Math.round(y / scale) } : f
    ));
  };

  const updateFieldSize = (fieldId, width, height) => {
    setFields(prevFields => prevFields.map(f => 
      f.id === fieldId ? { ...f, width: Math.round(width), height: Math.round(height) } : f
    ));
  };

  const updateFieldProperty = (fieldId, property, value) => {
    setFields(prevFields => prevFields.map(f => 
      f.id === fieldId ? { ...f, [property]: value } : f
    ));
  };

  const handleSave = async () => {
    if (!pdfData) {
      toast.error('Carregue um PDF primeiro');
      return;
    }

    try {
      // Salvar PDF base
      await onSave('contract_pdf_base', pdfData);
      // Salvar campos
      await onSave('contract_pdf_fields', fields);
      toast.success('Configurações do PDF salvas com sucesso!');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar configurações');
    }
  };

  const getVariableLabel = (variable) => {
    const found = AVAILABLE_VARIABLES.find(v => v.value === variable);
    return found ? found.label : variable;
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          {pdfData ? 'Trocar PDF Base' : 'Carregar PDF Base'}
        </Button>
        {pdfData && (
          <span className="text-sm text-green-600">✓ PDF carregado</span>
        )}
      </div>

      {/* Add Field Section */}
      {pdfData && (
        <Card className="p-4 bg-slate-50">
          <h4 className="font-semibold text-slate-700 mb-3">Adicionar Campo</h4>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Variável</Label>
              <Select value={newFieldVariable} onValueChange={setNewFieldVariable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_VARIABLES.map(v => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label} ({v.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <Label className="text-xs">Fonte (px)</Label>
              <Input
                type="number"
                min="6"
                max="24"
                value={newFieldFontSize}
                onChange={(e) => setNewFieldFontSize(parseInt(e.target.value) || 10)}
              />
            </div>
            <Button onClick={addField} className="gap-2 bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </div>
        </Card>
      )}

      {/* PDF Preview with Draggable and Resizable Fields */}
      {pdfData && (
        <div 
          ref={containerRef}
          className="relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-100 overflow-auto"
          style={{ maxHeight: '600px' }}
        >
          <div className="relative inline-block">
            <Document
              file={`data:application/pdf;base64,${pdfData}`}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="p-8 text-center">Carregando PDF...</div>}
              error={<div className="p-8 text-center text-red-500">Erro ao carregar PDF</div>}
            >
              <Page 
                pageNumber={1} 
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {/* Draggable and Resizable Fields */}
            {fields.map((field) => (
              <DraggableResizableField
                key={field.id}
                field={field}
                scale={scale}
                selectedField={selectedField}
                onSelect={setSelectedField}
                onPositionChange={updateFieldPosition}
                onResize={updateFieldSize}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fields List */}
      {fields.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold text-slate-700 mb-3">Campos Configurados ({fields.length})</h4>
          <p className="text-xs text-slate-500 mb-3">
            Clique no campo no PDF para selecionar. Arraste o canto inferior direito para redimensionar.
          </p>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {fields.map((field) => (
              <div 
                key={field.id} 
                className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                  selectedField === field.id ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 hover:bg-slate-100'
                }`}
                onClick={() => setSelectedField(field.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{getVariableLabel(field.variable)}</span>
                  <span className="text-xs text-slate-500">
                    Pos: {field.x}x{field.y} | Tam: {field.width || 150}x{field.height || 30} | Fonte: {field.fontSize}px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="6"
                    max="24"
                    value={field.fontSize}
                    onChange={(e) => updateFieldProperty(field.id, 'fontSize', parseInt(e.target.value) || 10)}
                    className="w-14 h-8 text-xs"
                    title="Tamanho da fonte"
                  />
                  <Input
                    type="number"
                    min="50"
                    max="500"
                    value={field.width || 150}
                    onChange={(e) => updateFieldProperty(field.id, 'width', parseInt(e.target.value) || 150)}
                    className="w-16 h-8 text-xs"
                    title="Largura"
                  />
                  <Input
                    type="number"
                    min="20"
                    max="200"
                    value={field.height || 30}
                    onChange={(e) => updateFieldProperty(field.id, 'height', parseInt(e.target.value) || 30)}
                    className="w-14 h-8 text-xs"
                    title="Altura"
                  />
                  <Button
                    size="sm"
                    variant={field.bold ? 'default' : 'outline'}
                    className="h-8 w-8 p-0 text-xs font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateFieldProperty(field.id, 'bold', !field.bold);
                    }}
                    title="Negrito"
                  >
                    B
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(field.id);
                    }}
                    title="Remover campo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Save Button */}
      {pdfData && (
        <Button onClick={handleSave} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Save className="w-4 h-4" />
          Salvar Configurações do PDF Base
        </Button>
      )}

      {/* Instructions */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <strong>Como usar:</strong><br/>
          1) Carregue um PDF base (máx. 5MB, 1 página)<br/>
          2) Adicione campos e arraste-os para a posição desejada<br/>
          3) <strong>Redimensione</strong> os campos arrastando o canto inferior direito (ou ajuste os valores na lista)<br/>
          4) O texto será quebrado automaticamente dentro da área definida<br/>
          5) Salve as configurações
        </p>
      </div>
    </div>
  );
};

export default ContractPdfEditor;
