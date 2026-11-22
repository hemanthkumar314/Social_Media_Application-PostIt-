import React, { createContext,useCallback,useContext,useEffect,useMemo,useState } from "react"
import { INITIAL_USER } from "./INITIAL_USER"
import { IContexttype, IUser } from "@/types"
import { getCurrentUser } from "@/lib/appwrite/api"

const INITIAL_STATE={
    user:INITIAL_USER,
    isLoading:false,
    isAuthenticated:false,
    setUser:()=>{},
    setIsAuthenticated:()=>{},
    checkAuthUser:async()=> false as boolean,
}

const AuthContext = createContext<IContexttype>(INITIAL_STATE)

const AuthProvider = ({children}:{children:React.ReactNode}) => {

    const [user, setUser] = useState<IUser>(INITIAL_USER);
    const [isLoading, setisLoading] = useState(true);
    const [isAuthenticated,setIsAuthenticated] = useState(false);

    const checkAuthUser = useCallback(async(): Promise<boolean> =>{
        try{
            const currentAccount = await getCurrentUser();

            if(currentAccount){
                setUser({
                    id:currentAccount.$id,
                    name:currentAccount.name,
                    username:currentAccount.username,
                    imageUrl:currentAccount.imageUrl,
                    bio:currentAccount.bio
                })
                setIsAuthenticated(true);

                return true;
            }
            setUser(INITIAL_USER);
            setIsAuthenticated(false);
            return false;
        }catch(err){
            console.log(err);
            setUser(INITIAL_USER);
            setIsAuthenticated(false);
            return false
        }
        finally{
            setisLoading(false);
        }
    }, []);

    useEffect(() => {
        void checkAuthUser();
      }, [checkAuthUser]);

    const value = useMemo(() => ({
      user,
      setUser,
      isLoading,
      isAuthenticated,
      setIsAuthenticated,
      checkAuthUser
  }), [user, isLoading, isAuthenticated, checkAuthUser]);
  
    
  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider;

// eslint-disable-next-line react-refresh/only-export-components
export const useUserContext = () => useContext(AuthContext)
