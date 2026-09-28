import { useState, useEffect } from 'react';
import { PageHero, PageShell } from '@/components/explorer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listResources } from '../api/resources';
import type { Resource, ResourceType } from '../api/resources';
import { FaVideo, FaFilePowerpoint, FaFilePdf, FaFileAlt, FaSearch } from 'react-icons/fa';

export default function ResourceLibrary() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [filterType, setFilterType] = useState<ResourceType | 'all'>('all');
  const [searchTitle, setSearchTitle] = useState('');

  const fetchLibrary = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listResources({
        title: searchTitle || undefined,
        resource_type: filterType !== 'all' ? filterType : undefined
      });
      setResources(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load resources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce course search slightly if typing
    const timer = setTimeout(() => {
      fetchLibrary();
    }, 300);
    return () => clearTimeout(timer);
  }, [filterType, searchTitle]);

  const handleResourceClick = (resource: Resource) => {
    if (resource.resource_type === 'video') {
      window.open(`/resources/video/${resource.resource_id}`, '_blank');
    } else {
      window.open(`/resources/document/${resource.resource_id}`, '_blank');
    }
  };

  const getIcon = (type: ResourceType) => {
    switch(type) {
      case 'video': return <FaVideo className="w-6 h-6 text-blue-500" />;
      case 'ppt': return <FaFilePowerpoint className="w-6 h-6 text-orange-500" />;
      case 'notes': return <FaFilePdf className="w-6 h-6 text-red-500" />;
      case 'cheatsheet': return <FaFileAlt className="w-6 h-6 text-emerald-500" />;
    }
  };

  return (
    <PageShell>
      <PageHero
        title="Resource Library"
        subtitle="Access lectures, notes, and study materials."
      />

        <div className="flex flex-col md:flex-row gap-4 bg-muted/50 p-4 rounded-lg border border-border">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-3 text-muted-foreground" />
            <Input 
              placeholder="Search by Title (e.g. Introduction to Qubits)"
              className="pl-10"
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {(['all', 'video', 'ppt', 'notes', 'cheatsheet'] as const).map(type => (
              <Button 
                key={type}
                variant={filterType === type ? 'default' : 'outline'}
                onClick={() => setFilterType(type)}
                className="capitalize whitespace-nowrap"
              >
                {type === 'all' ? 'All Types' : type}
              </Button>
            ))}
          </div>
        </div>



        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-destructive/15 text-destructive rounded-lg text-center font-medium">
            {error}
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-border">
            <p className="text-muted-foreground text-lg">No resources found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map(res => (
              <Card 
                key={res.resource_id} 
                className="hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => handleResourceClick(res)}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="p-3 bg-muted rounded-lg group-hover:scale-110 transition-transform relative">
                    {getIcon(res.resource_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {res.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate mt-1" title={res.description}>
                      {res.description}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs font-medium px-2 py-1 bg-secondary text-secondary-foreground rounded-md truncate max-w-[150px]" title={res.filename}>
                        {res.filename}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(res.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </PageShell>
  );
}
