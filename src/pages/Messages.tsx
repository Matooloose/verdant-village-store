import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Send,
  Home,
  ShoppingCart,
  Package,
  MessageCircle,
  Search,
  Shield,
  User
} from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'admin' | 'farmer' | 'buyer';
  message: string;
  timestamp: Date;
  isRead: boolean;
}

interface Chat {
  id: string;
  participantId: string;
  participantName: string;
  participantType: 'admin' | 'farmer';
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

const Messages = () => {
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [chats] = useState<Chat[]>([
    {
      id: "1",
      participantId: "admin",
      participantName: "FarmersBracket",
      participantType: "admin",
      lastMessage: "Welcome to FarmersBracket! How can we help you today?",
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      unreadCount: 1
    },
    {
      id: "2", 
      participantId: "farmer1",
      participantName: "Green Valley Farm",
      participantType: "farmer",
      lastMessage: "Your order has been prepared and is ready for pickup",
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      unreadCount: 0
    },
    {
      id: "3",
      participantId: "farmer2", 
      participantName: "Sunny Acres",
      participantType: "farmer",
      lastMessage: "Thank you for your order! We'll have it ready by tomorrow",
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      unreadCount: 2
    }
  ]);

  const [messages] = useState<Message[]>([
    {
      id: "1",
      senderId: "admin",
      senderName: "FarmersBracket",
      senderType: "admin",
      message: "Welcome to FarmersBracket! How can we help you today?",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      isRead: false
    },
    {
      id: "2",
      senderId: "farmer1",
      senderName: "Green Valley Farm", 
      senderType: "farmer",
      message: "Your order has been prepared and is ready for pickup",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      isRead: true
    }
  ]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    // Here you would send the message to the backend
    setNewMessage("");
  };

  const getSenderDisplayName = (senderType: string, senderName: string) => {
    return senderType === 'admin' ? 'FarmersBracket' : senderName;
  };

  const getParticipantIcon = (type: 'admin' | 'farmer') => {
    return type === 'admin' ? Shield : User;
  };

  const bottomNavItems = [
    { icon: Home, label: "Home", path: "/home" },
    { icon: ShoppingCart, label: "Cart", path: "/cart" },
    { icon: Package, label: "Track", path: "/track-order" },
    { icon: MessageCircle, label: "Messages", path: "/messages", active: true },
    { icon: Search, label: "Browse", path: "/browse-products" },
  ];

  if (selectedChat) {
    const chat = chats.find(c => c.id === selectedChat);
    const chatMessages = messages.filter(m => 
      m.senderId === chat?.participantId || m.senderId === "current-user"
    );

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Chat Header */}
        <header className="sticky top-0 z-50 bg-card border-b shadow-soft">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedChat(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10">
                  {chat?.participantType === 'admin' ? (
                    <Shield className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold text-foreground">
                  {getSenderDisplayName(chat?.participantType || 'farmer', chat?.participantName || '')}
                </h1>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
            <div className="w-9" />
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-4 pb-24">
          {chatMessages.map((message) => (
            <div key={message.id} className={`flex ${message.senderId === 'current-user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${
                message.senderId === 'current-user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                <p className="text-sm">{message.message}</p>
                <p className="text-xs opacity-70 mt-1">
                  {format(message.timestamp, 'HH:mm')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="sticky bottom-16 bg-card border-t p-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} className="px-4">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

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
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-soft">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">Messages</h1>
            <p className="text-sm text-muted-foreground">{chats.length} conversations</p>
          </div>
          <div className="w-9" />
        </div>
      </header>

      {/* Chat List */}
      <main className="p-4 pb-20">
        {chats.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No messages yet</h2>
            <p className="text-muted-foreground">Start a conversation with farmers or support</p>
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => {
              const ParticipantIcon = getParticipantIcon(chat.participantType);
              
              return (
                <Card 
                  key={chat.id} 
                  className="cursor-pointer hover:shadow-medium transition-shadow"
                  onClick={() => setSelectedChat(chat.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10">
                          <ParticipantIcon className="h-5 w-5 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground truncate">
                            {getSenderDisplayName(chat.participantType, chat.participantName)}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">
                              {format(chat.lastMessageTime, 'HH:mm')}
                            </span>
                            {chat.unreadCount > 0 && (
                              <Badge className="bg-primary text-primary-foreground min-w-[20px] h-5 text-xs">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {chat.lastMessage}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

export default Messages;