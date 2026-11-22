import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useSignOutAccount } from '@/lib/react-query/queriesAndMutations';
import { sidebarLinks } from '@/constants';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';

const LeftSidebar = () => {
  const {mutateAsync: signOut, isSuccess, isPending} = useSignOutAccount();
  const navigate = useNavigate();
  const {toast} = useToast();
  useEffect(() => { if (isSuccess) navigate(0); }, [isSuccess, navigate]);

  async function logout() {
    try { await signOut(); }
    catch { toast({title: 'Unable to log out. Please try again.'}); }
  }

  return <nav aria-label="Main navigation" className="leftsidebar">
    <Link to="/" aria-label="PostIt home" className="mx-3 mb-8 flex shrink-0 items-center">
      <img src="/assets/images/logo.svg" alt="PostIt" width={132} height={36} />
    </Link>
    <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
      <ul className="flex flex-col gap-2">
        {sidebarLinks.map(link => <li key={link.label}>
          <NavLink to={link.route} end={link.route === '/'}
            className={({isActive}) => `leftsidebar-link group ${isActive ? 'bg-primary-500 text-white' : 'text-light-2'}`}>
            {({isActive}) => <>
              <img src={link.imgURL} alt="" aria-hidden="true" width={22} height={22}
                className={`shrink-0 group-hover:invert-white ${isActive ? 'invert-white' : ''}`} />
              <span>{link.label}</span>
            </>}
          </NavLink>
        </li>)}
      </ul>
    </div>
    <div className="mt-4 shrink-0 border-t border-dark-4 pt-4">
      <Button variant="ghost" className="!h-12 w-full !justify-start !gap-3 rounded-lg px-3 text-sm font-medium leading-5 hover:bg-dark-4"
        onClick={() => void logout()} disabled={isPending}>
        <img src="/assets/icons/logout.svg" alt="" aria-hidden="true" width={22} height={22} className="shrink-0" />
        {isPending ? 'Logging out…' : 'Logout'}
      </Button>
    </div>
  </nav>;
};

export default LeftSidebar;