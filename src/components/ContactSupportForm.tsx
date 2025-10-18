import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabaseAny } from '@/integrations/supabase/client';

interface Props {
  defaultName?: string;
  defaultEmail?: string;
  onSuccess?: (ticketId: string) => void;
}

export default function ContactSupportForm({ defaultName = '', defaultEmail = '', onSuccess }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast({ title: 'Validation', description: 'Please provide a subject and message', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Minimal server-side insert - using supabaseAny if needed
      const { data, error } = await supabaseAny
        .from('support_tickets')
        .insert({ title: subject, description: message, user_email: email, user_name: name })
        .select()
        .single();

      if (error) throw error;
      toast({ title: 'Ticket Created', description: 'We will get back to you shortly.' });
      setSubject('');
      setMessage('');
      onSuccess?.(data?.id);
    } catch (err) {
      console.error('Failed to create support ticket', err);
      toast({ title: 'Error', description: 'Failed to create support ticket', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
      </div>

      <div>
        <Label>Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
      </div>

      <div>
        <Label>Message</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Describe your issue" />
      </div>

      <div className="flex items-center gap-3">
  <input ref={fileRef} type="file" className="hidden" aria-label="Attach files" />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>Attach files</Button>
        <div className="text-sm text-muted-foreground">Supported: images, pdf, logs</div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send'}</Button>
      </div>
    </form>
  );
}
