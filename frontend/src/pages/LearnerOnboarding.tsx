import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clearSignupRole } from '@/lib/roles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LearnerOnboarding() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [topic, setTopic] = useState('');
  const role = 'learner';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (e) {
      console.error("Error logging out", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);
    setError('');

    try {
      const token = await currentUser.getIdToken();
      
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_URL}/api/onboarding`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          age: parseInt(age),
          topic,
          role
        })
      });

      if (response.ok) {
        clearSignupRole();
        navigate('/dashboard');
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to save onboarding data");
      }
    } catch (error) {
      console.error("Error saving data:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white text-lg font-medium animate-pulse">Setting up your profile...</p>
        </div>
      )}
      <div className="min-h-screen w-full flex">
        {/* Left Column - Image & Branding */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-black text-white">
          <div className="absolute inset-0 z-0">
            <img 
              src="/bloch_sphere.png" 
              alt="Quantum Bloch Sphere" 
              className="w-full h-full object-cover opacity-90 mix-blend-screen scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
            <div className="absolute inset-0 bg-emerald-900/20 mix-blend-overlay"></div>
          </div>
          
          <div className="relative z-10 flex justify-between items-center w-full">
            <div className="flex items-center gap-3 text-2xl font-sans">
              <img src="/apple-touch-icon.png" alt="Qrious Logo" className="w-10 h-10 rounded-full" />
              Qrious
            </div>
            <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </div>

          <div className="relative z-10 max-w-lg mt-auto">
            <h2 className="text-5xl font-sans leading-tight mb-6">
              Personalize your journey.
            </h2>
            <p className="text-lg text-white/80">
              Tell us a bit about yourself so our AI tutor can tailor the quantum mechanics curriculum to your specific interests and experience level.
            </p>
          </div>
        </div>

        {/* Right Column - Onboarding Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background relative">
          <div className="absolute top-8 right-8 lg:hidden">
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </div>
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="mb-8 mt-12 lg:mt-0">
              <div className="lg:hidden flex items-center gap-3 text-2xl font-sans mb-8">
                <img src="/apple-touch-icon.png" alt="Qrious Logo" className="w-8 h-8 rounded-full" />
                Qrious
              </div>
              <h1 className="text-4xl font-sans tracking-tight mb-2">Complete Profile</h1>
              <p className="text-muted-foreground text-lg">
                Let's get to know you better.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 rounded-md bg-destructive/15 text-destructive text-sm font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="Ada Lovelace" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  className="h-12"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-medium">Age</Label>
                <Input 
                  id="age" 
                  type="number" 
                  min="1" 
                  placeholder="25" 
                  value={age} 
                  onChange={(e) => setAge(e.target.value)} 
                  required 
                  className="h-12"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-sm font-medium">Interested Quantum Topic</Label>
                <Select value={topic} onValueChange={setTopic} required>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Quantum Algorithms">Quantum Algorithms</SelectItem>
                    <SelectItem value="Quantum Cryptography">Quantum Cryptography</SelectItem>
                    <SelectItem value="Quantum Hardware">Quantum Hardware</SelectItem>
                    <SelectItem value="Quantum Machine Learning">Quantum Machine Learning</SelectItem>
                    <SelectItem value="General Physics">General Physics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button type="submit" className="w-full h-12 text-lg mt-8" disabled={loading}>
                Continue to Dashboard
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
