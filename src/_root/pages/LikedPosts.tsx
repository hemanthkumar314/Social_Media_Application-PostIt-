import GridPostList from "@/components/shared/GridPostList";
import Loader from "@/components/shared/Loader";
import { useGetCurrentUser } from "@/lib/react-query/queriesAndMutations";


const LikedPosts = () => {
  const { data: currentUser, isPending, isError } = useGetCurrentUser();

  if (isPending)
    return (
      <div className="w-full h-full flex-center">
        <Loader />
      </div>
    );

  if (isError || !currentUser) return <p role="alert">Unable to load liked posts.</p>;

  return (
    <>
      {!currentUser.liked?.length && (
        <p className="text-light-4">No liked posts</p>
      )}

      <GridPostList posts={currentUser.liked ?? []} ShowStats={false} />
    </>
  );
};

export default LikedPosts;
