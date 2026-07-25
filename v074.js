// v0.7.4: keep the user on the search screen when adding extra favorite clubs.
selectTeam=function(id,asPrimary){
  if(!state.favorites.includes(id))state.favorites.push(id);
  const needsPrimary=asPrimary||!state.primary;
  if(needsPrimary)state.primary=id;
  save();

  if(needsPrimary){
    state.view='home';
    setActiveNav('home');
    render();
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }

  // Adding from the normal team search should not kick the user back home.
  state.view='search';
  setActiveNav('search');
  render();
};
