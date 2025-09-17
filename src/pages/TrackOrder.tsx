import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  Home,
  ShoppingCart,
  MessageCircle,
  Search,
  MapPin
} from "lucide-react";
import LiveTrackingDialog from "@/components/LiveTrackingDialog";

interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  total: number;
  items: number;
  estimatedDelivery: string;
  farmName: string;
  trackingId?: string;
}

const TrackOrder = () => {
  const navigate = useNavigate();
  const [orders] = useState<Order[]>([
    {
      id: "1",
      orderNumber: "FB-2024-001",
      status: "shipped",
      total: 28.47,
      items: 3,
      estimatedDelivery: "Today, 3:00 PM",
      farmName: "Green Valley Farm",
      trackingId: "TRK123456789"
    },
    {
      id: "2",
      orderNumber: "FB-2024-002",
      status: "processing",
      total: 15.99,
      items: 2,
      estimatedDelivery: "Tomorrow, 2:00 PM",
      farmName: "Sunny Acres"
    },
    {
      id: "3",
      orderNumber: "FB-2024-003",
      status: "delivered",
      total: 42.30,
      items: 5,
      estimatedDelivery: "Delivered",
      farmName: "Organic Fields"
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5" />;
      case 'processing':
        return <Package className="h-5 w-5" />;
      case 'shipped':
        return <Truck className="h-5 w-5" />;
      case 'delivered':
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'processing':
        return 'bg-info/10 text-info border-info/20';
      case 'shipped':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'delivered':
        return 'bg-success/10 text-success border-success/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const bottomNavItems = [
    { icon: Home, label: "Home", path: "/home" },
    { icon: ShoppingCart, label: "Cart", path: "/cart" },
    { icon: Package, label: "Track", path: "/track-order", active: true },
    
    { icon: Search, label: "Browse", path: "/browse-products" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-soft">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">Track Orders</h1>
            <p className="text-sm text-muted-foreground">{orders.length} orders</p>
          </div>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-20">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No orders yet</h2>
            <p className="text-muted-foreground mb-6">Start shopping to see your orders here</p>
            <Button onClick={() => navigate('/home')} className="bg-gradient-to-r from-primary to-primary-light">
              Start Shopping
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{order.orderNumber}</CardTitle>
                      <p className="text-sm text-muted-foreground">{order.farmName}</p>
                    </div>
                    <Badge className={`${getStatusColor(order.status)} border`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(order.status)}
                        <span className="capitalize">{order.status}</span>
                      </div>
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items:</span>
                    <span>{order.items} item{order.items !== 1 ? 's' : ''}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">R{order.total.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {order.status === 'delivered' ? 'Status:' : 'Estimated Delivery:'}
                    </span>
                    <span className={order.status === 'delivered' ? 'text-success font-medium' : ''}>
                      {order.estimatedDelivery}
                    </span>
                  </div>

                  {order.trackingId && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tracking ID:</span>
                      <span className="font-mono text-xs">{order.trackingId}</span>
                    </div>
                  )}

                  {order.status === 'shipped' && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-2">
                          <Truck className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Out for delivery</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your order is on its way and will arrive soon
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {order.status === 'delivered' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-success">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Delivered successfully</span>
                      </div>
                      <Button variant="outline" size="sm">
                        Rate Order
                      </Button>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    {order.status !== 'delivered' && (
                      <LiveTrackingDialog 
                        orderId={order.id}
                        trigger={
                          <Button variant="outline" size="sm" className="flex-1">
                            <MapPin className="h-4 w-4 mr-1" />
                            Track Live
                          </Button>
                        }
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-strong">
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center px-3 py-2 h-auto ${
                item.active ? 'text-primary' : ''
              }`}
              onClick={() => navigate(item.path)}
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{item.label}</span>
            </Button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default TrackOrder;