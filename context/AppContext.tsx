
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Section, Disease, FileAttachment, Banner } from '../types';
import { FileType } from '../types';

interface AppContextType {
  isAdmin: boolean;
  isLoading: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
  sections: Section[];
  addSection: (name: string, icon: string, colorClass: string) => void;
  updateSection: (sectionId: string, newName: string, newIcon: string, newColorClass: string) => void;
  deleteSection: (sectionId: string) => void;
  addDisease: (sectionId: string, name: string, description: string) => void;
  updateDisease: (sectionId: string, diseaseId: string, newName: string, newDescription: string) => void;
  deleteDisease: (sectionId: string, diseaseId: string) => void;
  addFileToDisease: (sectionId: string, diseaseId: string, file: File, name: string, description: string) => void;
  deleteFileFromDisease: (sectionId: string, diseaseId: string, fileId: string) => void;
  banners: Banner[];
  addBanner: (file: File, title: string, description: string) => void;
  updateBanner: (bannerId: string, title: string, description: string, imageFile: File | null) => void;
  deleteBanner: (bannerId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LoadingSpinner: React.FC = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 to-violet-200">
      <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-sky-500"></div>
    </div>
);


export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch sections and banners in parallel
        const [sectionsData, bannersData] = await Promise.all([
            fetchSections(),
            fetchBanners()
        ]);
        setSections(sectionsData);
        setBanners(bannersData);
      } catch (error) {
        console.error("Failed to load app data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchBanners = async (): Promise<Banner[]> => {
        const bannersRes = await fetch('./data/banners.json');
        return await bannersRes.json();
    }
    
    const fetchSections = async (): Promise<Section[]> => {
        const sectionsRes = await fetch('./data/sections.json');
        const sectionsMeta: { id: string; name: string; icon: string; colorClass: string; }[] = await sectionsRes.json();

        return Promise.all(
          sectionsMeta.map(async (sectionMeta) => {
            const diseasesRes = await fetch(`./data/${sectionMeta.id}/diseases.json`);
            const diseaseIds: string[] = await diseasesRes.json();

            const diseasesData = await Promise.all(
              diseaseIds.map(async (diseaseId) => {
                const manifestRes = await fetch(`./data/${sectionMeta.id}/${diseaseId}/manifest.json`);
                const manifest: { name: string; files: { path: string; name: string; description: string; type: FileType }[] } = await manifestRes.json();
                
                const descriptionRes = await fetch(`./data/${sectionMeta.id}/${diseaseId}/description.txt`);
                const description = await descriptionRes.text();
                
                const files: FileAttachment[] = manifest.files ? manifest.files.map((f, index) => ({
                    id: `${diseaseId}-${index}`,
                    name: f.name,
                    description: f.description,
                    type: f.type,
                    dataUrl: `./data/${sectionMeta.id}/${diseaseId}/${f.path}`
                })) : [];

                const disease: Disease = {
                    id: diseaseId,
                    name: manifest.name,
                    description: description,
                    files: files,
                };
                return disease;
              })
            );

            const section: Section = {
                id: sectionMeta.id,
                name: sectionMeta.name,
                icon: sectionMeta.icon,
                colorClass: sectionMeta.colorClass,
                diseases: diseasesData,
            };
            return section;
          })
        );
    }

    loadData();
  }, []);

  const login = (user: string, pass: string): boolean => {
    if (user === '5850008985' && pass === '64546') {
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
  };

  const addSection = (name: string, icon: string, colorClass: string) => {
    const newSection: Section = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      icon,
      colorClass,
      diseases: []
    };
    setSections(prev => [...prev, newSection]);
  };

  const updateSection = (sectionId: string, newName: string, newIcon: string, newColorClass: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, name: newName, icon: newIcon, colorClass: newColorClass } : section
    ));
  };

  const deleteSection = (sectionId: string) => {
    setSections(prev => prev.filter(section => section.id !== sectionId));
  };

  const addDisease = (sectionId: string, name: string, description: string) => {
    const newDisease: Disease = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description,
      files: []
    };
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? { ...section, diseases: [...section.diseases, newDisease] }
        : section
    ));
  };
  
  const updateDisease = (sectionId: string, diseaseId: string, newName: string, newDescription: string) => {
    setSections(prev => prev.map(section => {
        if (section.id !== sectionId) return section;
        return {
            ...section,
            diseases: section.diseases.map(disease => 
                disease.id === diseaseId ? { ...disease, name: newName, description: newDescription } : disease
            )
        };
    }));
  };

  const deleteDisease = (sectionId: string, diseaseId: string) => {
    setSections(prev => prev.map(section => {
        if (section.id !== sectionId) return section;
        return {
            ...section,
            diseases: section.diseases.filter(disease => disease.id !== diseaseId)
        };
    }));
  };

  const getFileType = (mimeType: string): FileType => {
      if (mimeType.startsWith('image/')) return FileType.IMAGE;
      if (mimeType === 'application/pdf') return FileType.PDF;
      if (mimeType.startsWith('audio/')) return FileType.AUDIO;
      return FileType.UNKNOWN;
  }

  const addFileToDisease = (sectionId: string, diseaseId: string, file: File, name: string, description: string) => {
      const dataUrl = URL.createObjectURL(file);
      const newFile: FileAttachment = {
          id: `${Date.now()}-${file.name}`,
          name: name,
          description: description,
          type: getFileType(file.type),
          dataUrl
      };
      setSections(prev => prev.map(section => 
          section.id === sectionId ? {
              ...section,
              diseases: section.diseases.map(disease => 
                  disease.id === diseaseId ? {
                      ...disease,
                      files: [...disease.files, newFile]
                  } : disease
              )
          } : section
      ));
  };

  const deleteFileFromDisease = (sectionId: string, diseaseId: string, fileId: string) => {
    setSections(prev => prev.map(section => {
        if (section.id !== sectionId) return section;
        return {
            ...section,
            diseases: section.diseases.map(disease => {
                if (disease.id !== diseaseId) return disease;
                return {
                    ...disease,
                    files: disease.files.filter(file => file.id !== fileId)
                }
            })
        };
    }));
  };

  const addBanner = (file: File, title: string, description: string) => {
      const imageUrl = URL.createObjectURL(file);
      const newBanner: Banner = {
          id: `${Date.now()}-${file.name}`,
          title,
          description,
          imageUrl,
      };
      setBanners(prev => [...prev, newBanner]);
  };

  const updateBanner = (bannerId: string, title: string, description: string, imageFile: File | null) => {
    if (imageFile) {
        const imageUrl = URL.createObjectURL(imageFile);
        setBanners(prev => prev.map(banner =>
            banner.id === bannerId ? { ...banner, title, description, imageUrl } : banner
        ));
    } else {
        setBanners(prev => prev.map(banner =>
            banner.id === bannerId ? { ...banner, title, description } : banner
        ));
    }
  };

  const deleteBanner = (bannerId: string) => {
      setBanners(prev => prev.filter(banner => banner.id !== bannerId));
  };


  return (
    <AppContext.Provider value={{ 
        isAdmin,
        isLoading,
        login, 
        logout, 
        sections, 
        addSection,
        updateSection,
        deleteSection,
        addDisease,
        updateDisease,
        deleteDisease, 
        addFileToDisease,
        deleteFileFromDisease,
        banners,
        addBanner,
        updateBanner,
        deleteBanner,
    }}>
      {isLoading ? <LoadingSpinner /> : children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
