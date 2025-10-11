import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import BottomNavBar from '@/components/BottomNavBar';
// import { SkeletonLoaders } from '@/components/SkeletonLoaders';
import { MapPin, Star, ArrowRight, ArrowLeft } from 'lucide-react';

interface Farm {
  id: string;
  name: string;
  image_url?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  review_count?: number | null;
  farm_size?: string | null;
  farmer_id: string;
  description?: string | null;
}

interface FarmerProfile {
  id: string;
  name: string | null;
  address: string | null;
  image_url: string | null;
}

interface FarmWithProfile extends Farm {
  farmerProfile?: FarmerProfile;
}

const AllFarms: React.FC = () => {
  const [farms, setFarms] = useState<FarmWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFarms = async () => {
      setLoading(true);
      try {
        // First fetch farms
        const { data: farmsData, error: farmsError } = await supabase
          .from('farms')
          .select('*')
          .order('name', { ascending: true });
        
        if (farmsError) {
          console.error('Error fetching farms:', farmsError);
          setFarms([]);
          setLoading(false);
          return;
        }

        if (!farmsData || farmsData.length === 0) {
          setFarms([]);
          setLoading(false);
          return;
        }

        // Get unique farmer IDs
        const farmerIds = [...new Set(farmsData.map(farm => farm.farmer_id).filter(Boolean))];
        
        // Fetch farmer profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, address, image_url')
          .in('id', farmerIds);

        if (profilesError) {
          console.error('Error fetching farmer profiles:', profilesError);
        }

        // Create a map of farmer profiles
        const profilesMap = new Map();
        profilesData?.forEach(profile => {
          profilesMap.set(profile.id, profile);
        });

        // Merge farms with their farmer profiles
        const farmsWithProfiles: FarmWithProfile[] = farmsData.map(farm => ({
          ...farm,
          image_url: farm.image_url ?? null,
          location: farm.location ?? null,
          latitude: farm.latitude ?? null,
          longitude: farm.longitude ?? null,
          farm_size: farm.farm_size ?? null,
          rating: null,
          review_count: null,
          farmerProfile: profilesMap.get(farm.farmer_id) || null
        }));

        setFarms(farmsWithProfiles);
      } catch (error) {
        console.error('Error in fetchFarms:', error);
        setFarms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFarms();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Back Button */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Browse All Farms</h1>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 px-4 py-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {farms.map(farm => (
              <Card key={farm.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {(farm.image_url || farm.farmerProfile?.image_url) ? (
                      <img 
                        src={farm.image_url || farm.farmerProfile?.image_url || ''} 
                        alt={farm.name} 
                        className="w-12 h-12 rounded-full object-cover mr-2" 
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mr-2">
                        <MapPin className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <span>{farm.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span 
                      className="text-sm text-muted-foreground truncate" 
                      title={farm.farmerProfile?.address || farm.location || 'Address not available'}
                    >
                      {farm.farmerProfile?.address || farm.location || 'Address not available'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">{farm.rating ?? 0}</span>
                    <span className="text-xs text-muted-foreground">({farm.review_count ?? 0} reviews)</span>
                  </div>
                  {farm.farm_size && (
                    <div className="text-xs text-muted-foreground mb-2">{farm.farm_size}</div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-between"
                    onClick={() => navigate(`/farms/${farm.id}`)}
                  >
                    View Farm
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Bottom Navigation */}
      <BottomNavBar />
    </div>
  );
};

import ErrorBoundary from "../components/ErrorBoundary";

const WrappedAllFarms = () => (
  <ErrorBoundary>
    <AllFarms />
  </ErrorBoundary>
);

export default WrappedAllFarms;
