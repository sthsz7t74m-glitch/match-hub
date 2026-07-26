window.SportsHubNationalService={
  endpoint:'./data/national-matches.json',
  async load(){
    try{
      const response=await fetch(`${this.endpoint}?v=230`,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      return Array.isArray(payload.matches)?payload.matches:[];
    }catch(error){
      console.warn('National match data unavailable:',error);
      return [];
    }
  },
  forTeam(matches,teamId){
    return matches.filter(match=>match.home===teamId||match.away===teamId);
  },
  upcoming(matches,now=new Date()){
    return matches.filter(match=>new Date(match.kickoff)>now).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  },
  finished(matches,now=new Date()){
    return matches.filter(match=>match.status==='finished'||new Date(match.kickoff)<=now).sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff));
  }
};