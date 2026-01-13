
import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface EditProfileProps {
  onBack: () => void;
  user: {
    firstName: string;
    lastName: string;
    username: string;
    avatar: string;
  };
  session: any;
}

const EditProfile: React.FC<EditProfileProps> = ({ onBack, user, session }) => {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [username, setUsername] = useState(user.username);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const cleanUsername = username.trim().toLowerCase().replace(/\s/g, '');
    
    if (!cleanUsername || cleanUsername.length < 3) {
      alert("Username must be at least 3 characters");
      return;
    }

    if (!session?.user?.id) {
      alert("No active session found. Please log in again.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Check if username is already taken by SOMEONE ELSE
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', session.user.id)
        .maybeSingle();

      if (checkError) console.warn('Username check failed, proceeding anyway...', checkError);
      if (existingUser) {
        throw new Error('This username is already taken by another student.');
      }

      let avatarUrl = user.avatar;

      // 2. Handle Image Upload
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, selectedFile, { upsert: true });
        
        if (uploadError) {
          console.error('Storage Upload Error:', uploadError);
          throw new Error(`Avatar upload failed: ${uploadError.message}`);
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        avatarUrl = publicUrl;
      }

      const fullName = `${firstName} ${lastName}`.trim();

      // 3. Update Auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: avatarUrl,
          first_name: firstName,
          last_name: lastName,
          username: cleanUsername
        }
      });
      if (authError) console.warn('Auth metadata sync failed:', authError.message);

      // 4. Update Public Profile Table
      const profileData = {
        id: session.user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        username: cleanUsername,
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });
      
      if (profileError) {
        console.error('Database Upsert Error:', profileError);
        throw profileError;
      }

      alert('Profile updated successfully!');
      onBack();
    } catch (err: any) {
      console.error('Save Error:', err);
      
      // Extract the most helpful message
      let msg = 'Unknown Error';
      if (typeof err === 'string') msg = err;
      else if (err.message) msg = err.message;
      else if (err.error_description) msg = err.error_description;
      else msg = JSON.stringify(err);

      if (msg.includes('row-level security') || msg.includes('42501')) {
        alert('Database Access Denied (RLS). Please ensure you have run the latest SQL fix script in your Supabase dashboard.');
      } else if (msg.includes('duplicate key') || msg.includes('23505')) {
        alert('That username is already taken. Please try another one.');
      } else {
        alert('Update Failed: ' + msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between mb-8 pt-8">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:scale-90 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Edit Profile</h2>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="text-orange-600 font-black text-sm uppercase tracking-widest disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
      
      <div className="flex flex-col items-center mb-8">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <img 
            src={previewUrl || user.avatar} 
            className="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-orange-50 bg-orange-100 shadow-inner group-hover:brightness-90 transition-all" 
            alt="Avatar" 
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-black/40 p-3 rounded-2xl backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
          </div>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        <p className="mt-3 text-[10px] font-black text-orange-600 uppercase tracking-widest">Tap to Change Photo</p>
      </div>

      <div className="space-y-6 overflow-y-auto no-scrollbar pb-10">
        <div className="space-y-1">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Campus Username</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">@</span>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="w-full p-4 pl-8 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-bold" 
              placeholder="username"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">First Name</label>
            <input 
              type="text" 
              value={firstName} 
              onChange={(e) => setFirstName(e.target.value)} 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-bold" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Last Name</label>
            <input 
              type="text" 
              value={lastName} 
              onChange={(e) => setLastName(e.target.value)} 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-bold" 
            />
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="w-full bg-orange-600 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-orange-100 active:scale-[0.98] transition-all uppercase tracking-widest text-sm disabled:opacity-50"
        >
          {isSaving ? 'Updating Campus Profile...' : 'Save Profile Changes'}
        </button>
      </div>
    </div>
  );
};

export default EditProfile;
