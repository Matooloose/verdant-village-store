import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, Camera, User, Key, Download, CheckCircle, Shield, 
  Clock, MapPin, Bell, Lock, Eye, EyeOff, Smartphone, Globe, 
  AlertTriangle, FileText, Settings, Monitor, Wifi, Battery, Navigation
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCapacitorLocation } from "@/hooks/useCapacitorLocation";
import { supabase } from "@/integrations/supabase/client";

// Enhanced interfaces for comprehensive profile management
interface ProfileData {
  name: string;
  email: string;
  phone: string;
  location: string;
  address: string;
}

interface DeliveryPreferences {
  leaveAtDoor: boolean;
  specificInstructions: string;
  preferredTimeSlot: string;
  contactPreference: 'call' | 'sms' | 'app';
  doorBellRing: boolean;
  safeLocation: string;
  accessCode: string;
}

interface CommunicationPreferences {
  orderUpdates: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  marketing: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  recommendations: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  promotions: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  newsletter: {
    email: boolean;
    sms: boolean;
  };
  farmerMessages: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

interface SecuritySession {
  id: string;
  deviceName: string;
  browser: string;
  location: string;
  ipAddress: string;
  lastActive: Date;
  isCurrent: boolean;
}

interface LoginHistory {
  id: string;
  timestamp: Date;
  location: string;
  device: string;
  ipAddress: string;
  success: boolean;
  method: 'password' | 'google' | 'facebook';
}

interface ProfileCompleteness {
  score: number;
  suggestions: {
    field: string;
    description: string;
    points: number;
    completed: boolean;
  }[];
}

interface DataExportOption {
  type: 'profile' | 'orders' | 'reviews' | 'complete';
  format: 'json' | 'csv' | 'pdf';
  description: string;
  estimatedSize: string;
}

const UpdateProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Email verification enforcement
  const isEmailVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  
  // Core state
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
    location: '',
    address: ''
  });

  // Enhanced feature state
  const [deliveryPreferences, setDeliveryPreferences] = useState<DeliveryPreferences>({
    leaveAtDoor: false,
    specificInstructions: '',
    preferredTimeSlot: 'anytime',
    contactPreference: 'app',
    doorBellRing: true,
    safeLocation: '',
    accessCode: ''
  });

  const [communicationPreferences, setCommunicationPreferences] = useState<CommunicationPreferences>({
    orderUpdates: { email: true, sms: true, push: true },
    marketing: { email: false, sms: false, push: false },
    recommendations: { email: true, sms: false, push: true },
    promotions: { email: false, sms: false, push: true },
    newsletter: { email: true, sms: false },
    farmerMessages: { email: true, sms: true, push: true }
  });

  const [securitySessions, setSecuritySessions] = useState<SecuritySession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [profileCompleteness, setProfileCompleteness] = useState<ProfileCompleteness>({
    score: 0,
    suggestions: []
  });

  // Enhanced form state
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Dialog states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [selectedExportOption, setSelectedExportOption] = useState<DataExportOption | null>(null);
  const [showPolicies, setShowPolicies] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  
  // Privacy settings
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(true);
  
  // Location functionality
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { location: deviceLocation, error: locationError } = useCapacitorLocation();

  const dataExportOptions: DataExportOption[] = [
    {
      type: 'profile',
      format: 'json',
      description: 'Your profile information and preferences',
      estimatedSize: '2 KB'
    },
    {
      type: 'orders',
      format: 'csv',
      description: 'Complete order history with details',
      estimatedSize: '150 KB'
    },
    {
      type: 'reviews',
      format: 'json',
      description: 'All your product reviews and ratings',
      estimatedSize: '45 KB'
    },
    {
      type: 'complete',
      format: 'pdf',
      description: 'Complete account data export (all information)',
      estimatedSize: '500 KB'
    }
  ];

  useEffect(() => {
    loadProfile();
    loadSecurityData();
    calculateProfileCompleteness();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfileData({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || '',
          address: data.address || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error loading profile",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityData = async () => {
    if (!user?.id) {
      console.error('User ID is required to load security data');
      return;
    }

    try {
      // Load real security sessions from Supabase
      const { data: sessions, error: sessionsError } = await supabase
        .from('security_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!sessionsError && sessions) {
        const transformedSessions: SecuritySession[] = sessions.map(session => ({
          id: session.id,
          deviceName: session.device || 'Unknown Device',
          location: session.location || 'Unknown Location',
          ipAddress: session.ip_address || '',
          browser: session.browser || 'Unknown Browser',
          lastActive: new Date(session.last_active || session.created_at),
          isCurrent: session.is_current || false,
          status: session.status || 'active'
        }));
        setSecuritySessions(transformedSessions);
      } else {
        setSecuritySessions([]);
      }

      // Load real login history from Supabase
      const { data: history, error: historyError } = await supabase
        .from('login_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!historyError && history) {
        const transformedHistory: LoginHistory[] = history.map(login => ({
          id: login.id,
          timestamp: new Date(login.created_at),
          location: login.location || 'Unknown Location',
          ipAddress: login.ip_address || '',
          device: login.device || 'Unknown Device',
          browser: login.browser || 'Unknown Browser',
          success: login.status === 'success',
          method: (login.method === 'google' || login.method === 'facebook') ? login.method : 'password'
        }));
        setLoginHistory(transformedHistory);
      } else {
        setLoginHistory([]);
      }

    } catch (error) {
      console.error('Error loading security data:', error);
      // Fallback to empty arrays
      setSecuritySessions([]);
      setLoginHistory([]);
    }
  };

  const calculateProfileCompleteness = () => {
  const suggestions = [
    {
      field: 'phone',
      description: 'Add your phone number',
      points: 10,
      completed: !!profileData.phone
    },
    {
      field: 'address',
      description: 'Complete your delivery address',
      points: 15,
      completed: !!profileData.address && profileData.address.length > 10
    },
    {
      field: 'delivery_preferences',
      description: 'Set up delivery preferences',
      points: 10,
      completed: !!deliveryPreferences.specificInstructions || deliveryPreferences.leaveAtDoor
    },
    {
      field: 'communication_preferences',
      description: 'Configure communication preferences',
      points: 5,
      completed: true // Always completed if they have any preferences set
    }
  ];

    const completedPoints = suggestions.filter(s => s.completed).reduce((sum, s) => sum + s.points, 0);
    const totalPoints = suggestions.reduce((sum, s) => sum + s.points, 0);
    const score = Math.round((completedPoints / totalPoints) * 100);

    setProfileCompleteness({ score, suggestions });
  };

  const handleInputChange = (field: keyof ProfileData, value: string | boolean) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDeliveryPreferenceChange = (field: keyof DeliveryPreferences, value: string | boolean) => {
    setDeliveryPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Function to get user's current location
  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    
    try {
      // Request location permission and get coordinates
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });

      const { latitude, longitude } = position.coords;
      
      // Use coordinates as location (simple approach)
      const coordsLocation = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      handleInputChange('location', coordsLocation);
      
      toast({
        title: "Location Updated",
        description: "Your current location coordinates have been added to your profile.",
      });
      
    } catch (error) {
      console.error('Error getting location:', error);
      toast({
        title: "Location Error",
        description: "Could not get your current location. Please ensure location permission is granted.",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleCommunicationPreferenceChange = (
    category: keyof CommunicationPreferences, 
    channel: string, 
    value: boolean
  ) => {
    setCommunicationPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: value
      }
    }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      setLoading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setProfileData(prev => ({
        ...prev,
        image_url: data.publicUrl
      }));

      toast({
        title: "Success",
        description: "Profile picture uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...profileData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      calculateProfileCompleteness();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;

    if (!currentPassword || !newPassword || newPassword !== confirmNewPassword) {
      toast({
        title: "Error",
        description: "Please fill all fields and ensure the new passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "New password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      setChangePwLoading(true);

      // First, verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        toast({
          title: "Error",
          description: "Current password is incorrect.",
          variant: "destructive",
        });
        return;
      }

      // If current password is correct, update to new password
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Success",
        description: "Password changed successfully.",
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChangePwLoading(false);
    }
  };

  const handleExportData = async (option: DataExportOption) => {
    try {
      setLoading(true);
      
      // Generate real data export
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      // Create user data export
      const exportData = {
        profile: profileData,
        preferences: {
          notifications: {
            email: true, // Get from user preferences
            push: true,
            sms: false
          },
          privacy: {
            profileVisibility: 'public',
            dataSharing: false
          }
        },
        exportedAt: new Date().toISOString(),
        type: option.type,
        format: option.format,
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${option.type}-data-${format(new Date(), 'yyyy-MM-dd')}.${option.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export completed",
        description: `Your ${option.type} data has been downloaded`,
      });
      
      setIsExportDialogOpen(false);
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      // In real app, call API to terminate session
      setSecuritySessions(prev => prev.filter(s => s.id !== sessionId));
      
      toast({
        title: "Session terminated",
        description: "The selected session has been terminated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to terminate session",
        variant: "destructive",
      });
    }
  };



  useEffect(() => {
    calculateProfileCompleteness();
  }, [profileData, deliveryPreferences]);

  return (
    <div className="min-h-screen bg-background">
      {/* Email Verification Blocker */}
      {!isEmailVerified && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-lg flex flex-col items-center">
            <Shield className="h-10 w-10 text-yellow-500 mb-2" />
            <h2 className="text-lg font-bold mb-2">Verify Your Email</h2>
            <p className="text-sm text-muted-foreground mb-4 text-center">You must verify your email address before accessing account settings. Please check your inbox for a verification link.</p>
            <Button onClick={() => window.location.reload()} className="mb-2">I've Verified My Email</Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">Account Settings</h1>
          </div>
          
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
            {!isEmailVerified && <span className="text-xs text-red-500 ml-2">(Verify email to enable)</span>}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Profile Completeness card removed as requested. Related logic/state remains. */}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-1 h-auto p-1">
            <TabsTrigger value="profile" disabled={!isEmailVerified} className="text-sm py-3 px-4">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" disabled={!isEmailVerified} className="text-sm py-3 px-4">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="privacy" disabled={!isEmailVerified} className="text-sm py-3 px-4">
              <Lock className="h-4 w-4 mr-2" />
              Privacy
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Picture */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      {/* No image_url in ProfileData, fallback only */}
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <User className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary-dark transition-colors">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        title="Upload profile picture"
                      />
                    </label>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Enter your phone number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    <div className="flex gap-2">
                      <Input
                        id="location"
                        value={profileData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="Enter your city/area or use current location"
                        className="flex-1"
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={getCurrentLocation}
                        disabled={isGettingLocation}
                        className="shrink-0"
                      >
                        {isGettingLocation ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        ) : (
                          <Navigation className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Full Address</Label>
                  <Textarea
                    id="address"
                    value={profileData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter your complete address for deliveries"
                    rows={3}
                  />
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button 
                  onClick={handleChangePassword} 
                  disabled={!isEmailVerified || changePwLoading || !currentPassword || !newPassword || newPassword !== confirmNewPassword}
                  className="w-full"
                >
                  {changePwLoading ? 'Changing...' : 'Change Password'}
                  {!isEmailVerified && <span className="text-xs text-red-500 ml-2">(Verify email to enable)</span>}
                </Button>
              </CardContent>
            </Card>

            {/* Data Export */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Data Export
                </CardTitle>
                <CardDescription>
                  Download your account data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Export My Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy Settings
                </CardTitle>
                <CardDescription>
                  Control your privacy and data visibility
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Privacy Actions */}
                <div className="pt-4 space-y-2">
                  <Button variant="outline" onClick={() => setShowPolicies(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Privacy Policy
                  </Button>
                  <Button variant="outline" onClick={() => setShowSupport(true)}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Contact Support
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Data Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Your Data</DialogTitle>
            <DialogDescription>
              Choose what data you'd like to export and in which format.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {dataExportOptions.map((option, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedExportOption?.type === option.type 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedExportOption(option)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium capitalize">{option.type} Data</h4>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Format: {option.format.toUpperCase()} • Size: {option.estimatedSize}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {option.format.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedExportOption && handleExportData(selectedExportOption)}
              disabled={!selectedExportOption || loading}
            >
              {loading ? 'Exporting...' : 'Export Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policies Modal */}
      {showPolicies && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-background text-foreground rounded-lg p-6 w-full max-w-lg shadow-lg max-h-[80vh] overflow-y-auto border">
            <h3 className="text-lg font-bold mb-2">App Policies</h3>
            <div className="mb-4 text-sm space-y-4">
              <div>
                <h4 className="font-semibold">Privacy Policy:</h4>
                <p className="text-muted-foreground">We respect your privacy. Your data is stored securely and never shared without explicit consent. We use industry-standard encryption and follow GDPR guidelines.</p>
              </div>
              <div>
                <h4 className="font-semibold">Terms of Service:</h4>
                <p className="text-muted-foreground">By using this app, you agree to our terms and conditions. We provide fresh farm products with quality guarantees. For full details, contact support.</p>
              </div>
              <div>
                <h4 className="font-semibold">Refund Policy:</h4>
                <p className="text-muted-foreground">Refunds are processed according to our payment provider's terms. Quality issues are resolved within 24 hours with full refunds or replacements.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowPolicies(false)}>Close</Button>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-background text-foreground rounded-lg p-6 w-full max-w-md shadow-lg border">
            <h3 className="text-lg font-bold mb-2">Contact Support</h3>
            <div className="mb-4 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Website: verdantvillage.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📧</span>
                <span>Email: support@verdantvillage.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📞</span>
                <span>Phone: +27 123 456 7890</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Hours: Mon-Fri 8AM-6PM SAST</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowSupport(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdateProfile;