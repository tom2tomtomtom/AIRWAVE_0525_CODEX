import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface Client {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
}

interface ClientContextType {
  clients: Client[];
  activeClient: Client | null;
  loading: boolean;
  setActiveClient: (client: Client) => void;
  createClient: (clientData: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (id: string, clientData: Partial<Omit<Client, 'id'>>) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
}

const ClientContext = createContext<ClientContextType>({
  clients: [],
  activeClient: null,
  loading: true,
  setActiveClient: () => {},
  createClient: async () => ({ id: '', name: '', description: '', primaryColor: '', secondaryColor: '' }),
  updateClient: async () => ({ id: '', name: '', description: '', primaryColor: '', secondaryColor: '' }),
  deleteClient: async () => {},
});

export const useClient = () => useContext(ClientContext);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  // Load clients from API on initial load
  useEffect(() => {
    if (isAuthenticated) {
      const loadClients = async () => {
        try {
          // Get user from localStorage
          const storedUser = localStorage.getItem("airwave_user");
          if (!storedUser) {
            setLoading(false);
            return;
          }
          
          const user = JSON.parse(storedUser);
          
          // Fetch clients from API
          const response = await fetch("/api/clients", {
            headers: {
              Authorization: `Bearer ${user.token || "mock_token"}`,
            },
          });
          
          const data = await response.json();
          
          if (response.ok && data.success && data.clients) {
            setClients(data.clients);
            
            // Check for active client in localStorage
            const storedActiveClient = localStorage.getItem("airwave_active_client");
            if (storedActiveClient) {
              setActiveClient(JSON.parse(storedActiveClient));
            } else if (data.clients.length > 0 && data.clients[0]) {
              // Set first client as active if none is selected
              setActiveClient(data.clients[0]);
              localStorage.setItem("airwave_active_client", JSON.stringify(data.clients[0]));
            }
          } else {
            // Fallback to localStorage if API fails
            const storedClients = localStorage.getItem('airwave_clients');
            const parsedClients = storedClients ? JSON.parse(storedClients) : [];
            setClients(parsedClients);

            // Load active client from localStorage
            const storedActiveClient = localStorage.getItem('airwave_active_client');
            if (storedActiveClient) {
              setActiveClient(JSON.parse(storedActiveClient));
            } else if (parsedClients.length > 0 && parsedClients[0]) {
              // Set first client as active if none is selected
              setActiveClient(parsedClients[0]);
              localStorage.setItem('airwave_active_client', JSON.stringify(parsedClients[0]));
            }
          }
        } catch (error) {
          console.error('Error loading clients:', error);
          
          // Fallback to localStorage
          const storedClients = localStorage.getItem('airwave_clients');
          const parsedClients = storedClients ? JSON.parse(storedClients) : [];
          setClients(parsedClients);

          const storedActiveClient = localStorage.getItem('airwave_active_client');
          if (storedActiveClient) {
            setActiveClient(JSON.parse(storedActiveClient));
          } else if (parsedClients.length > 0 && parsedClients[0]) {
            setActiveClient(parsedClients[0]);
            localStorage.setItem('airwave_active_client', JSON.stringify(parsedClients[0]));
          }
        } finally {
          setLoading(false);
        }
      };

      loadClients();
    } else {
      setClients([]);
      setActiveClient(null);
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Update active client
  const handleSetActiveClient = (client: Client) => {
    setActiveClient(client);
    localStorage.setItem('airwave_active_client', JSON.stringify(client));
  };

  // Create a new client via API
  const createClient = async (clientData: Omit<Client, "id">): Promise<Client> => {
    const storedUser = localStorage.getItem("airwave_user");
    if (!storedUser) {
      throw new Error("User not authenticated");
    }
    
    const user = JSON.parse(storedUser);
    
    try {
      // Call API to create client
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token || "mock_token"}`,
        },
        body: JSON.stringify(clientData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to create client");
      }
      
      if (data.success && data.client) {
        // Add to clients list
        const updatedClients = [...clients, data.client];
        setClients(updatedClients);
        
        // Set as active client if it's the first one
        if (updatedClients.length === 1) {
          handleSetActiveClient(data.client);
        }
        
        return data.client;
      } else {
        throw new Error("Invalid response from server");
      }
      
      // Fallback to local generation if API fails
      const newClient: Client = {
        ...clientData,
        id: 'client_' + Math.random().toString(36).substring(2, 9),
      };

      // Add to clients list
      const updatedClients = [...clients, newClient];
      setClients(updatedClients);
      localStorage.setItem('airwave_clients', JSON.stringify(updatedClients));

      // Set as active client if it's the first one
      if (updatedClients.length === 1) {
        handleSetActiveClient(newClient);
      }

      return newClient;
    } catch (error) {
      console.error('Error creating client:', error);
      
      // Fallback to local creation
      const newClient: Client = {
        ...clientData,
        id: 'client_' + Math.random().toString(36).substring(2, 9),
      };

      const updatedClients = [...clients, newClient];
      setClients(updatedClients);
      localStorage.setItem('airwave_clients', JSON.stringify(updatedClients));

      if (updatedClients.length === 1) {
        handleSetActiveClient(newClient);
      }

      return newClient;
    }
  };

  // Update an existing client via API
  const updateClient = async (id: string, clientData: Partial<Omit<Client, "id">>): Promise<Client> => {
    const storedUser = localStorage.getItem("airwave_user");
    if (!storedUser) {
      throw new Error("User not authenticated");
    }
    
    const user = JSON.parse(storedUser);
    
    try {
      // Call API to update client
      const response = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token || "mock_token"}`,
        },
        body: JSON.stringify(clientData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to update client");
      }
      
      if (data.success && data.client) {
        // Update clients list
        const updatedClients = clients.map(c => c.id === id ? data.client : c);
        setClients(updatedClients);
        
        // Update active client if it's the one being updated
        if (activeClient?.id === id) {
          handleSetActiveClient(data.client);
        }
        
        return data.client;
      } else {
        throw new Error("Invalid response from server");
      }
      
      // Fallback to local update if API fails
      const clientIndex = clients.findIndex(c => c.id === id);
      if (clientIndex === -1) {
        throw new Error('Client not found');
      }

      // Update client data with explicit typing
      const existingClient = clients[clientIndex];
      const updatedClient: Client = {
        ...existingClient,
        ...Object.fromEntries(
          Object.entries(clientData).filter(([_, value]) => value !== undefined)
        )
      } as Client;
      const updatedClients = [...clients];
      updatedClients[clientIndex] = updatedClient;

      setClients(updatedClients);
      localStorage.setItem('airwave_clients', JSON.stringify(updatedClients));

      // Update active client if it's the one being updated
      if (activeClient?.id === id) {
        handleSetActiveClient(updatedClient);
      }

      return updatedClient;
    } catch (error) {
      console.error('Error updating client:', error);
      
      // Fallback to local update
      const clientIndex = clients.findIndex(c => c.id === id);
      if (clientIndex === -1) {
        throw new Error('Client not found');
      }

      // Update client data with explicit typing
      const existingClient = clients[clientIndex];
      const updatedClient: Client = {
        ...existingClient,
        ...Object.fromEntries(
          Object.entries(clientData).filter(([_, value]) => value !== undefined)
        )
      } as Client;
      const updatedClients = [...clients];
      updatedClients[clientIndex] = updatedClient;

      setClients(updatedClients);
      localStorage.setItem('airwave_clients', JSON.stringify(updatedClients));

      if (activeClient?.id === id) {
        handleSetActiveClient(updatedClient);
      }

      return updatedClient;
    }
  };

  // Delete a client via API
  const deleteClient = async (id: string): Promise<void> => {
    const storedUser = localStorage.getItem("airwave_user");
    if (!storedUser) {
      throw new Error("User not authenticated");
    }
    
    const user = JSON.parse(storedUser);
    
    try {
      // Call API to delete client
      const response = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${user.token || "mock_token"}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete client");
      }
      
      if (data.success) {
        // Update local state
        const updatedClients = clients.filter(c => c.id !== id);
        setClients(updatedClients);
        localStorage.setItem('airwave_clients', JSON.stringify(updatedClients));

        // If active client is deleted, set another one as active
        if (activeClient?.id === id) {
          if (updatedClients.length > 0 && updatedClients[0]) {
            handleSetActiveClient(updatedClients[0]);
          } else {
            setActiveClient(null);
            localStorage.removeItem('airwave_active_client');
          }
        }
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      
      // Fallback to local deletion
      const updatedClients = clients.filter(c => c.id !== id);
      setClients(updatedClients);
      localStorage.setItem('airwave_clients', JSON.stringify(updatedClients));

      if (activeClient?.id === id) {
        if (updatedClients.length > 0 && updatedClients[0]) {
          handleSetActiveClient(updatedClients[0]);
        } else {
          setActiveClient(null);
          localStorage.removeItem('airwave_active_client');
        }
      }
    }
  };

  return (
    <ClientContext.Provider
      value={{
        clients,
        activeClient,
        loading,
        setActiveClient: handleSetActiveClient,
        createClient,
        updateClient,
        deleteClient,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};