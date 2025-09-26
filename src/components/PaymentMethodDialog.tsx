import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Smartphone, Banknote, Building } from "lucide-react";

interface PaymentMethodDialogProps {
  onPaymentMethodSelect: (method: string) => void;
  trigger: React.ReactNode;
}

const PaymentMethodDialog = ({ onPaymentMethodSelect, trigger }: PaymentMethodDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");

  const paymentMethods = [
    {
      id: "cash",
      name: "Cash on Delivery",
      description: "Pay when your order arrives",
      icon: Banknote
    },
    {
      id: "card",
      name: "Bank Transfer",
      description: "Transfer to farmer's bank account",
      icon: Building
    },
    {
      id: "mobile",
      name: "Mobile Money",
      description: "Pay via mobile wallet",
      icon: Smartphone
    }
  ];

  const handlePayment = () => {
    if (selectedMethod) {
      onPaymentMethodSelect(selectedMethod);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Payment Method</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <div key={method.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50">
                  <RadioGroupItem value={method.id} id={method.id} />
                  <Icon className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <Label htmlFor={method.id} className="font-medium cursor-pointer">
                      {method.name}
                    </Label>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>

          <Button 
            onClick={handlePayment} 
            className="w-full" 
            disabled={!selectedMethod}
          >
            Proceed with Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodDialog;