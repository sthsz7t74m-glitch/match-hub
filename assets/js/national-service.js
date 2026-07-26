window.SportsHubNationalService={
  endpoint:'./data/national-matches.json',
  async loadPayload(){
    try{
      const response=await fetch(`${this.endpoint}?v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      return {
        updatedAt:payload.updatedAt||null,
        source:payload.source||'',
        competitionCount:payload.competitionCount||0,
        competitions:Array.isArray(payload.competitions)?payload.competitions:[],
        matches:Array.isArray(payload.matches)?payload.matches:[]
      };
    }catch(error){
      console.warn('National match data unavailable:',error);
      return {updatedAt:null,source:'',competitionCount:0,competitions:[],matches:[]};
    }
  },
  async load(){return (await this.loadPayload()).matches;},
  forTeam(matches,teamId){return matches.filter(match=>match.home===teamId||match.away===teamId);},
  upcoming(matches,now=new Date()){return matches.filter(match=>match.status!=='finished'&&new Date(match.kickoff)>now).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));},
  finished(matches){return matches.filter(match=>match.status==='finished').sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff));}
};
