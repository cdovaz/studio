
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AnalysisPopupProps {
  isOpen: boolean;
  onClose: () => void;
  analysisText: string;
  location: string;
}

export const AnalysisPopup: React.FC<AnalysisPopupProps> = ({ isOpen, onClose, analysisText, location }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* CORREÇÃO: Força o fundo branco e texto escuro para o popup */}
      <DialogContent className="max-w-3xl bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>Análise Urbanística para {location}</DialogTitle>
          <DialogDescription className="text-slate-600">
             Aqui está o plano preliminar gerado pela IA.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] rounded-md border bg-slate-50 p-4">
            {analysisText.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-4 text-sm text-slate-800 last:mb-0">
                    {paragraph}
                </p>
            ))}
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
