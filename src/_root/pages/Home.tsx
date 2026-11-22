// import React from 'react'

import Loader from "@/components/shared/Loader";
import PostCard from "@/components/shared/PostCard";
import { useGetRecentPosts } from "@/lib/react-query/queriesAndMutations";
import { Models } from "appwrite";

const Home = () => {
  const {data : posts, isPending:isPostLoading,isError:isErrorPosts,refetch} = useGetRecentPosts();
  
  return (
    <div className="flex flex-1">
      <div className="home-container">
        <div className="home-posts">
          <h2 className="w-full text-left h3-bold md:h2-bold">Home Feed</h2>
          {isPostLoading && !posts ?
            (<Loader/>)
            : isErrorPosts ? (
              <div role="alert"><p>Unable to load your feed.</p><button type="button" className="text-primary-500" onClick={() => void refetch()}>Try again</button></div>
            ) : posts?.documents.length === 0 ? <p className="text-light-3">No posts yet. Create the first one!</p> :
            (
              <ul className="flex flex-col flex-1 w-full gap-9">
                {posts?.documents.map((post:Models.Document)=>(
                  <PostCard post={post} key={post.$id}/>
                ))}
              </ul>
            )}
        </div>
      </div>
    </div>
  )
}

export default Home;
