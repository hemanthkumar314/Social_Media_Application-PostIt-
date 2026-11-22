
import { useDeletesavePost, useGetCurrentUser, useLikePost, useSavePost } from "@/lib/react-query/queriesAndMutations";
import { checkIsLiked } from "@/lib/utils";
import { Models } from "appwrite";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

type PostStatsProps ={
    post?: Models.Document;
    userId: string;
}

const PostStats = ({post,userId}:PostStatsProps) => {

  const [ likes, setLikes] = useState<string[]>(() => (post?.likes ?? []).map((user:Models.Document)=>user.$id));
  const { toast } = useToast();
  
  const { mutate : likePost, isPending:isLiking } = useLikePost();
  const { mutate : savePost, isPending:isSaving } = useSavePost();
  const { mutate : deleteSavedpost, isPending:isDeletingSave } = useDeletesavePost();

  const { data : currentuser, isPending:isUserLoading } = useGetCurrentUser();

  const savedPostRecord = currentuser?.save?.find((record:Models.Document)=>
    record.post?.$id === post?.$id
  );
  const isSaved = !!savedPostRecord;

  useEffect(()=>{
    setLikes((post?.likes ?? []).map((user:Models.Document)=>user.$id));
  },[post?.likes])

  const handleLikePost = (e:React.MouseEvent) =>{
    e.stopPropagation();
    if (!post?.$id || !userId || isLiking) return;

    let newLikes = [...likes];

    const hasliked = newLikes.includes(userId);

    if(hasliked){
      newLikes = newLikes.filter((id)=> id !== userId);
    }
    else{
      newLikes.push(userId);
    }

    setLikes(newLikes);
    const previousLikes = likes;
    const fail = () => {
      setLikes(previousLikes);
      toast({title:'Unable to update your like. Please try again.'});
    };
    likePost({postId:post.$id,likesArray:newLikes}, {onError:fail, onSuccess:(result) => {if (!result) fail();}})
  }

  const handleSavePost = (e:React.MouseEvent) =>{
    e.stopPropagation();
    if (!post?.$id || !userId || !currentuser || isSaving || isDeletingSave) return;

    const fail = () => {toast({title:'Unable to update saved posts. Please try again.'});};
    const callbacks = {onError:fail, onSuccess:(result:unknown) => {if (!result) fail();}};

    if(savedPostRecord){
      deleteSavedpost(savedPostRecord.$id, callbacks);
    }
    else{
      savePost({postId:post.$id,userId}, callbacks)
    }
      
  }

  return (
    <div className="z-20 flex items-start justify-between">
      <div className="flex gap-2 mr-5">
        <button type="button" aria-label="Like post" aria-pressed={checkIsLiked(likes,userId)} disabled={!post?.$id || !userId || isLiking} onClick={handleLikePost}>
        <img
            src={checkIsLiked(likes,userId) ? "/assets/icons/liked.svg":"/assets/icons/like.svg"}
            alt="like"
            width={20}
            height={20}
            className="cursor-pointer"
        />
        </button>
        <p className="small-medium lg:base-medium">{likes.length}</p>
      </div>

      <div className="flex gap-2 ">
        <button type="button" aria-label="Save post" aria-pressed={isSaved} disabled={!post?.$id || !userId || isUserLoading || !currentuser || isSaving || isDeletingSave} onClick={handleSavePost}>
        <img
            src={isSaved ? "/assets/icons/saved.svg":"/assets/icons/save.svg"}
            alt="save"
            width={20}
            height={20}
            className="cursor-pointer"
        />
        </button>
      </div>
    </div>
  )
}

export default PostStats
