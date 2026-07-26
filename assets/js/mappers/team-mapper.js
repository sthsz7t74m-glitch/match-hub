window.FootballTeamMapper=window.FootballTeamMapper||{};
(function(ns){
  const text=value=>String(value??'');
  const defaultNormalize=value=>text(value).toLowerCase()
    .replace(/f\.c\.|fc/g,'')
    .replace(/[・･\.．\-ー\s]/g,'')
    .replace(/ユナイテッド/g,'')
    .replace(/1969/g,'')
    .replace(/fmarinos|fマリノス/g,'マリノス')
    .replace(/sanfrecce|sanfreece/g,'サンフレッチェ')
    .replace(/avispa/g,'アビスパ')
    .replace(/vvaren/g,'vファーレン');

  class TeamMapper{
    constructor({teams=[],idMap={},nameMap={},normalize=defaultNormalize}={}){
      this.teams=teams;
      this.idMap={...idMap};
      this.reverseIdMap=Object.fromEntries(Object.entries(this.idMap).map(([appId,providerId])=>[text(providerId),appId]));
      this.nameMap={...nameMap};
      this.normalize=normalize;
      this.liveData=null;
    }

    setLiveData(data){this.liveData=data||null;return this;}
    setTeams(teams=[]){this.teams=teams;return this;}
    getEspnId(clubId){return text(this.idMap[text(clubId)]||clubId);}
    getClubId(teamId){return this.reverseIdMap[text(teamId)]||text(teamId);}
    getLeague(teamOrId){return this.getTeam(teamOrId)?.league||this.getClub(teamOrId)?.league||'';}
    getName(teamOrId){
      const team=typeof teamOrId==='object'&&teamOrId?teamOrId:this.getTeam(teamOrId);
      const id=text(team?.id||team?.uid||teamOrId);
      return this.nameMap[id]||team?.shortName||team?.displayName||team?.name||this.getClub(id)?.name||'未定';
    }
    getLogo(teamOrId){return this.getTeam(teamOrId)?.logo||'';}
    getClub(teamOrId){
      const id=typeof teamOrId==='object'&&teamOrId?text(teamOrId.id||teamOrId.uid):text(teamOrId);
      const clubId=this.getClubId(id);
      return this.teams.find(team=>text(team.id)===clubId)||null;
    }
    allLiveTeams(){
      const values=[...(this.liveData?.teams||[])];
      (this.liveData?.matches||[]).forEach(match=>values.push(match.home,match.away));
      (this.liveData?.standings||[]).forEach(row=>values.push(row.team));
      return [...new Map(values.filter(Boolean).map(team=>[text(team.id||team.uid||team.name||team.shortName),team])).values()];
    }
    aliases(team){return [team?.name,team?.shortName,team?.displayName,this.getName(team)].filter(Boolean).map(this.normalize);}
    getTeam(teamOrId){
      if(typeof teamOrId==='object'&&teamOrId)return teamOrId;
      const id=text(teamOrId),providerId=this.getEspnId(id),teams=this.allLiveTeams();
      const exact=teams.find(team=>text(team.id||team.uid)===providerId||text(team.id||team.uid)===id);
      if(exact)return exact;
      const club=this.getClub(id);
      if(!club)return null;
      const target=this.normalize(club.name),pool=teams.filter(team=>!team.league||team.league===club.league);
      const nameExact=pool.find(team=>this.aliases(team).includes(target));
      if(nameExact)return nameExact;
      const partial=pool.filter(team=>this.aliases(team).some(alias=>target.length>=5&&alias.length>=5&&(alias.includes(target)||target.includes(alias))));
      return partial.length===1?partial[0]:null;
    }
    findLiveTeam(club){return this.getTeam(club?.id||club);}
    findClubByTeam(team){
      const id=text(team?.id||team?.uid||team),mapped=this.getClub(id);
      if(mapped)return mapped;
      const names=this.aliases(team);
      return this.teams.find(club=>names.includes(this.normalize(club.name)))||null;
    }
    favoriteTeamIds(ids=[]){return ids.map(id=>this.getEspnId(id));}
  }

  Object.assign(ns,{TeamMapper,create:options=>new TeamMapper(options),normalizeName:defaultNormalize});
})(window.FootballTeamMapper);
