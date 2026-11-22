import GridPostList from '@/components/shared/GridPostList'
import Loader from '@/components/shared/Loader'
import SearchResults from '@/components/shared/SearchResults'
import { Input } from '@/components/ui/input'
import useDebounce from '@/hooks/useDebounce'
import { useGetPosts, useSearchPosts } from '@/lib/react-query/queriesAndMutations'
import { useEffect, useState } from 'react'
import { useInView } from "react-intersection-observer";
// import React from 'react'

const Explore = () => {
  const {ref,inView} = useInView();
  const { data:posts, fetchNextPage, hasNextPage, isPending, isError, isFetchingNextPage, isFetchNextPageError, refetch} = useGetPosts();
  const [SearchValue, setSearchValue] = useState('');
  const searchTerm = SearchValue.trim();
  const deBouncedvalue = useDebounce(searchTerm,500);

  const { data:searchedPosts, isFetching:isSearchFetching, isError:isSearchError } = useSearchPosts(deBouncedvalue);

  useEffect(()=>{
    if(inView && !searchTerm && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  },[inView,searchTerm,hasNextPage,isFetchingNextPage,isFetchNextPageError,fetchNextPage])

  const Showsearchresults = searchTerm !=='';
  const ShowPosts = posts?.pages.every((item)=>item.documents.length===0);
  
  return (
    <div className='explore-container'>
      
      <div className='explore-inner_container'>
        <h2 className='w-full h3-bold md:h2-bold'>Search Posts</h2>
        <div className='flex w-full gap-1 px-4 rounded-lg bg-dark-4'>
          <img
            src='/assets/icons/search.svg'
            alt='search'
            width={24}
            height={24}
          />
          <Input
            type='text'
            placeholder='Search'
            aria-label='Search posts'
            className='explore-search'
            value={SearchValue}
            onChange={(e)=> setSearchValue(e.target.value)}
          />
        </div>
      </div>
      
      <div className='w-full max-w-5xl mt-16 flex-between mb-7'>
        <h3 className='body-bold md:h3-bold'>{Showsearchresults ? 'Search results' : 'Latest posts'}</h3>
        
      </div>

      <div className='flex flex-wrap w-full max-w-5xl gap-4'>
        { Showsearchresults ? 
          (
            <SearchResults
              isSearchFetching = {isSearchFetching || searchTerm !== deBouncedvalue}
              searchedPosts={searchedPosts}
              isError={isSearchError}
            />
          ): isPending ? <Loader /> : isError && !posts ? (
            <div role="alert"><p>Unable to load posts.</p><button type="button" onClick={() => void refetch()} className="text-primary-500">Try again</button></div>
          ) : ShowPosts ?
          (
            <p className='w-full mt-10 text-center text-light-4'>
              End of Posts
            </p>
          ) : posts?.pages.map((item,index)=>(
            <GridPostList key={`page-${index}`} posts={item.documents}/>
          ))
        }
      </div>

      {isFetchNextPageError && !Showsearchresults && <button type="button" className="text-primary-500" onClick={() => void fetchNextPage()}>Unable to load more posts. Try again</button>}
      {hasNextPage && !Showsearchresults && !isFetchNextPageError && (
        <div ref={ref} className='mt-10'>
          <Loader/>
        </div>
      )}
      
    </div>
  )
}

export default Explore
