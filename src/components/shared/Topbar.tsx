import { Link,useNavigate } from "react-router-dom"
import { Button } from "../ui/button"
import { useSignOutAccount } from "@/lib/react-query/queriesAndMutations"
import { useEffect } from "react";
import { useUserContext } from "@/context/AuthContext";

const Topbar = () => {

    const { mutateAsync:signOut,isSuccess } = useSignOutAccount();
    const navigate=useNavigate();
    const {user}=useUserContext();
    
    useEffect(()=>{
        if(isSuccess){
            navigate(0);
        }
    },[isSuccess,navigate])
    return (
        <header className="topbar">
        <div className="flex h-[72px] items-center gap-4 px-5 md:px-8">
            <Link to='/' aria-label="PostIt home" className='flex items-center gap-3 md:hidden'>
            <img
                src="/assets/images/logo.svg"
                alt="PostIt"
                width={130}
                height={36}
            />
            </Link>

            <div className="ml-auto flex items-center gap-4">
                <Button variant="ghost" aria-label="Logout" className="shad-button_ghost md:!hidden" onClick={()=>signOut()}>
                <img
                    src="/assets/icons/logout.svg"
                    alt=""
                    width={22}
                    height={22}
                />
                </Button>
                <Link to={`/profile/${user.id}`} aria-label="Your profile" className="flex min-w-0 items-center gap-3 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                    <div className="hidden max-w-[180px] text-right sm:block">
                      <p className="truncate text-sm font-semibold leading-5">{user.name}</p>
                      <p className="truncate text-xs leading-4 text-light-3">@{user.username}</p>
                    </div>
                    <img
                        src={user.imageUrl || '/assets/icons/profile-placeholder.svg'}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                </Link>
            </div>

        </div>
        </header>
    )
    }

export default Topbar
