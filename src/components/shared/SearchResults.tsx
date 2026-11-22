import { Models } from "appwrite";
import Loader from "./Loader";
import GridPostList from "./GridPostList";

// import React from 'react'
type SearchResultsProps = {
  isSearchFetching:boolean;
  searchedPosts?:Models.DocumentList<Models.Document>;
  isError?:boolean;
}
const SearchResults = ({isSearchFetching,searchedPosts,isError}:SearchResultsProps) => {
  if(isSearchFetching) return <Loader/>
  if(isError) return <p role="alert">Unable to search posts. Please try again.</p>

  if(searchedPosts && searchedPosts.documents.length > 0)
  {
    return (
      <GridPostList posts={searchedPosts.documents}/>
    )
  }
  return (
    <p className="w-full mt-10 text-center text-light-4">No results Found</p>
  )
}

export default SearchResults
