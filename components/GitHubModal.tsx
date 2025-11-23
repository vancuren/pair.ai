import React, { useState } from 'react';
import { Github, X, CheckCircle, AlertCircle } from 'lucide-react';
import { GitHubConfig } from '../types';
import { validateRepo } from '../services/githubService';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: GitHubConfig) => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    setError(null);

    const config: GitHubConfig = { owner, repo, token };

    try {
      const isValid = await validateRepo(config);
      if (isValid) {
        onConnect(config);
        onClose();
      } else {
        setError("Could not access repository. Check credentials.");
      }
    } catch (e) {
      setError("Connection failed.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-[#202124] w-full max-w-md rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <Github className="text-white" /> Connect GitHub
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Owner (Username/Org)</label>
            <input 
              required
              type="text" 
              value={owner}
              onChange={e => setOwner(e.target.value)}
              className="w-full bg-[#303134] text-white rounded px-3 py-2 border border-gray-600 focus:border-blue-500 outline-none"
              placeholder="e.g. facebook"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Repository Name</label>
            <input 
              required
              type="text" 
              value={repo}
              onChange={e => setRepo(e.target.value)}
              className="w-full bg-[#303134] text-white rounded px-3 py-2 border border-gray-600 focus:border-blue-500 outline-none"
              placeholder="e.g. react"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Personal Access Token (Classic)</label>
            <input 
              required
              type="password" 
              value={token}
              onChange={e => setToken(e.target.value)}
              className="w-full bg-[#303134] text-white rounded px-3 py-2 border border-gray-600 focus:border-blue-500 outline-none"
              placeholder="ghp_..."
            />
            <p className="text-xs text-gray-500 mt-1">Requires 'repo' scope.</p>
          </div>

          {error && (
            <div className="bg-red-900/30 text-red-300 px-3 py-2 rounded flex items-center gap-2 text-sm border border-red-500/30">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isValidating}
            className={`w-full py-2 rounded font-medium flex justify-center items-center gap-2 mt-2 ${isValidating ? 'bg-gray-600' : 'bg-[#8ab4f8] text-gray-900 hover:bg-[#aecbfa]'}`}
          >
            {isValidating ? 'Connecting...' : 'Connect Repository'}
          </button>
        </form>
      </div>
    </div>
  );
};