import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ContactSupportForm from '@/components/ContactSupportForm';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactSupportDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl p-0">
        <div className="max-h-[80vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <ContactSupportForm onSuccess={(id) => {
              onOpenChange(false);
              toast({ title: 'Ticket submitted', description: `Ticket ${id} created` });
            }} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
