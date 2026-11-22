import GridPostList from "@/components/shared/GridPostList";
import Loader from "@/components/shared/Loader";
import { useGetCurrentUser } from "@/lib/react-query/queriesAndMutations";
import { Models } from "appwrite";


const Saved = () => {
  const { data: currentUser, isPending, isError } = useGetCurrentUser();

  const savePosts = (currentUser?.save ?? [])
    .filter((savePost: Models.Document) => savePost.post?.$id)
    .map((savePost: Models.Document) => savePost.post)
    .reverse();

  return (
    <div className="saved-container">
      <div className="flex w-full max-w-5xl gap-2">
        <img
          src="/assets/icons/save.svg"
          width={36}
          height={36}
          alt="edit"
          className="invert-white"
        />
        <h2 className="w-full text-left h3-bold md:h2-bold">Saved Posts</h2>
      </div>

      {isPending ? (
        <Loader />
      ) : isError || !currentUser ? (
        <p role="alert">Unable to load saved posts.</p>
      ) : (
        <div className="flex justify-center w-full max-w-5xl gap-9">
          {savePosts.length === 0 ? (
            <p className="text-light-4">No available posts</p>
          ) : (
            <GridPostList posts={savePosts} ShowStats={false} />
          )}
        </div>
      )}
    </div>
  );
};

export default Saved;
