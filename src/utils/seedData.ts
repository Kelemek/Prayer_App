import { supabase } from '../lib/supabase';

export const seedTestPrayers = async () => {
  
  const testPrayers = [
    {
      title: "Healing for Sarah",
      description: "Please pray for Sarah's quick recovery from surgery",
      status: "current",
      requester: "John Smith",
      date_requested: new Date().toISOString()
    },
    {
      title: "Job Search for Mark",
      description: "Pray that Mark finds the right job opportunity",
      status: "current",
      requester: "Mary Johnson",
      date_requested: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      title: "Safe Travel",
      description: "Prayers for safe travels on family vacation",
      status: "answered",
      requester: "Bob Wilson",
      date_requested: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      date_answered: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  try {
    const { error } = await supabase
      .from('prayers')
      .insert(testPrayers)
      .select();

    if (error) {
    console.error('Failed to seed prayers:', error);
  }
  } catch (error) {
    console.error('Failed to seed prayers:', error);
    return false;
  }
};