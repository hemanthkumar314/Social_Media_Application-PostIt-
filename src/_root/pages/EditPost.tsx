import PostForm from "@/components/forms/PostForm";
import Loader from "@/components/shared/Loader";
import { useGetPostbyId } from "@/lib/react-query/queriesAndMutations";
import { useUserContext } from "@/context/AuthContext";
import { useParams } from "react-router-dom";

const EditPost = () => {
  const { id } = useParams();
  const { data:post , isPending, isError } = useGetPostbyId(id||'');
  const { user } = useUserContext();

  if(isPending) return <Loader/>
  if(isError || !post) return <p role="alert" className="common-container">Unable to load this post.</p>;
  if(post.creator?.$id !== user.id) return <p role="alert" className="common-container">You can only edit your own posts.</p>;
  
  return (
    <div className="flex flex-1">
      <div className="common-container">
        <div className="justify-start w-full max-w-5xl gap-3 flex-start">
          <img
            src="/assets/icons/add-post.svg"
            width={36}
            height={36}
            alt="add"
          />
          <h2 className="w-full text-left h3-bold md:h2-bold">Edit Post</h2>
        </div>

        <PostForm action='Update' post={post}/>
      </div>
    </div>
  );
};

export default EditPost;
